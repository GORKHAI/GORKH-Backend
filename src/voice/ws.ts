import { randomUUID } from "node:crypto";
import type { RawData, WebSocket } from "ws";
import { and, asc, eq } from "drizzle-orm";
import { openDeepgramStream, type DeepgramStream } from "../asr/deepgram.js";
import { config } from "../config.js";
import { generateFastCue, type Cue } from "../cue/fast-cues.js";
import { db } from "../db/client.js";
import {
  agentTurns,
  brainReflections,
  cueEvents,
  humanProfileFacts,
  sessions,
  suggestions,
  transcriptSegments,
  voiceOutputs,
  voiceSessions,
  type InternalType,
  type VoiceOutputType,
} from "../db/schema.js";
import { clearSession, pushSegment, tryAcquireFastCueSlot, type BufferedSegment } from "../redis.js";
import { startSession, stopSession } from "../session/manager.js";
import { getOwnedSituationBrief } from "../situation/brief.js";
import { classifySegment, type TriggerEvent } from "../trigger/classifier.js";
import { proposeProfileFactsFromText } from "../human/profile.js";
import { detectResearchNeed } from "../research/need-detector.js";
import { getPlaybooks } from "../situation/playbooks.js";
import { cancelSubagentsForSession, getOwnedSubagentReport } from "../subagents/scheduler.js";
import { startResearchSubagent } from "../subagents/orchestrator.js";
import { answerVoiceUserText } from "./agent.js";
import { enforceCueForPolicy } from "./policy.js";
import { createTtsProvider } from "./tts.js";
import { voiceClientEventSchema, type OutputKind, type VoicePolicy, type VoiceServerEvent } from "./types.js";
import { VoiceStateMachine } from "./state.js";
import { logBrainAuditEvent } from "../brain/audit.js";
import { evaluateCueQuality } from "../evaluation/cue-quality.js";
import { persistEvaluation } from "../evaluation/research-quality.js";

interface VoiceLiveSession {
  sessionId: string;
  voiceSessionId: string;
  userId: string;
  situationBriefId: string | null;
  internalType: InternalType;
  policy: VoicePolicy;
  outputKind: OutputKind;
  generation: number;
  active: boolean;
  state: VoiceStateMachine;
  emit: (event: VoiceServerEvent) => void;
  lastCueAt: number | null;
  emittedSubagentReports: Set<string>;
}

type AgentFn = typeof answerVoiceUserText;
let agentFn: AgentFn = answerVoiceUserText;

export function setVoiceAgentForTest(fn: AgentFn): void {
  agentFn = fn;
}

export function resetVoiceAgentForTest(): void {
  agentFn = answerVoiceUserText;
}

const live = new Map<string, VoiceLiveSession>();

export function handleVoiceConnection(socket: WebSocket, userId: string): void {
  let session: VoiceLiveSession | null = null;
  let deepgram: DeepgramStream | null = null;
  let explicitlyStopped = false;

  const emit = (event: VoiceServerEvent): void => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event));
  };

  let queue = Promise.resolve();
  socket.on("message", (data: RawData, isBinary: boolean) => {
    queue = queue
      .then(() => handleMessage(data, isBinary))
      .catch((err) => emit({ type: "error", stage: "handler", message: String((err as Error).message ?? err) }));
  });

  async function handleMessage(data: RawData, isBinary: boolean): Promise<void> {
    if (isBinary) {
      if (!session || !deepgram) {
        emit({ type: "error", stage: "consent", message: "Audio is not accepted before an explicitly consented audio session starts." });
        return;
      }
      deepgram.sendAudio(rawDataToBuffer(data));
      return;
    }

    const parsed = voiceClientEventSchema.safeParse(JSON.parse(rawDataToBuffer(data).toString("utf8")));
    if (!parsed.success) {
      emit({ type: "error", stage: "protocol", message: parsed.error.message });
      return;
    }
    const msg = parsed.data;

    if (msg.type === "start") {
      if (session) {
        emit({ type: "error", stage: "start", message: "voice session already started" });
        return;
      }
      if (msg.consent.granted !== true) {
        emit({ type: "error", stage: "consent", message: "Live assist cannot start without explicit consent." });
        return;
      }
      if (msg.input.kind === "audio_pcm16" && !config.DEEPGRAM_API_KEY) {
        emit({ type: "error", stage: "provider", message: "Deepgram (DEEPGRAM_API_KEY) is not configured" });
        return;
      }

      const sessionId = await startSession({
        userId,
        situationBriefId: msg.situationBriefId ?? null,
        situationDescription: msg.situationDescription ?? null,
        consent: msg.consent,
        title: msg.title ?? null,
        retentionPolicy: msg.retentionPolicy,
        emit: () => undefined,
      });
      const base = await getBaseSession(userId, sessionId);
      const [voice] = await db
        .insert(voiceSessions)
        .values({
          sessionId,
          userId,
          policy: msg.policy,
          inputKind: msg.input.kind,
          outputKind: msg.output.kind,
          state: "listening",
          ttsProvider: config.VOICE_TTS_PROVIDER,
        })
        .returning();
      if (!voice || !base) throw new Error("failed to create voice session");

      session = {
        sessionId,
        voiceSessionId: voice.id,
        userId,
        situationBriefId: base.situationBriefId,
        internalType: base.internalType,
        policy: msg.policy,
        outputKind: msg.output.kind,
        generation: 0,
        active: true,
        state: new VoiceStateMachine("listening"),
        emit,
        lastCueAt: null,
        emittedSubagentReports: new Set<string>(),
      };
      live.set(sessionId, session);
      emit({
        type: "voice_ack",
        sessionId,
        voiceSessionId: voice.id,
        situationBriefId: base.situationBriefId,
        policy: msg.policy,
        internalType: base.internalType,
        state: "listening",
      });

      if (msg.input.kind === "audio_pcm16") {
        deepgram = openDeepgramStream(
          {
            onFinal: (segment) => {
              if (session) void ingestVoiceTranscript(session, segment).catch((err) => emit({ type: "error", stage: "ingest", message: String(err.message) }));
            },
            onPartial: (segment) => emit({ type: "voice_segment", speaker: segment.speaker, text: segment.text, isFinal: false }),
            onError: (err) => emit({ type: "error", stage: "asr", message: err.message }),
          },
          { selfSpeakerIndex: msg.selfSpeakerIndex ?? null },
        );
      }
      return;
    }

    if (!session?.active) {
      emit({ type: "error", stage: "state", message: "no active voice session; send start first" });
      return;
    }

    if (msg.type === "user_text") {
      await handleUserText(session, msg.text);
      return;
    }
    if (msg.type === "transcript") {
      await ingestVoiceTranscript(session, {
        speaker: msg.speaker,
        text: msg.text,
        offsetMs: msg.offsetMs,
        confidence: msg.confidence ?? null,
      });
      return;
    }
    if (msg.type === "speech_started") {
      await cancelSpeech(session, "barge_in");
      return;
    }
    if (msg.type === "speech_ended") {
      await transition(session, "listening");
      return;
    }
    if (msg.type === "stop") {
      explicitlyStopped = true;
      deepgram?.close();
      deepgram = null;
      await stopVoiceSession(session, msg.save);
      session = null;
    }
  }

  socket.on("close", () => {
    deepgram?.close();
    if (session && !explicitlyStopped) void interruptVoiceSession(session).catch(() => undefined);
  });
}

async function handleUserText(session: VoiceLiveSession, text: string): Promise<void> {
  await persistTurn(session, "user", "text", text);
  await logBrainAuditEvent({
    userId: session.userId,
    sessionId: session.sessionId,
    eventType: "user_text",
    payload: { chars: text.length, policy: session.policy },
  }).catch(() => null);
  await proposeProfileFactsFromText({ userId: session.userId, text, sessionId: session.sessionId }).catch(() => []);
  await transition(session, "thinking");
  const generation = session.generation;
  const researchNeed = detectResearchNeed({ text, internalType: session.internalType, livePolicy: session.policy });
  if (researchNeed.needsResearch && !isDailyLifeImmediateRequest(text)) {
    await startVoiceResearchSubagent(session, text, generation, session.policy === "whisper_copilot" ? "screen_only" : "main_agent_summary");
    const responseText = immediateResearchHoldingAnswer(session);
    const speechId = randomUUID();
    if (!(await canWrite(session, generation))) return;
    await persistTurn(session, "assistant", "text", responseText, { speechId, source: "subagent_handoff" });
    await persistOutput(session, "assistant_text", speechId, responseText, "emitted", { source: "subagent_handoff" });
    session.emit({ type: "voice_assistant_text", text: responseText, speechId });
    await maybeSpeak(session, speechId, responseText, "screen");
    return;
  }
  void produceAgentAnswer(session, text, generation).catch(async (err) => {
    if (!(await canWrite(session, generation))) return;
    await persistOutput(session, "error", null, String((err as Error).message ?? err), "failed", { stage: "provider" });
    session.emit({ type: "error", stage: "provider", message: String((err as Error).message ?? err) });
    await transition(session, "listening");
  });
}

function isDailyLifeImmediateRequest(text: string): boolean {
  return /\b(what do i need to do today|daily brief|today'?s priorities|what'?s on my plate|what should i do today|what am i waiting on|waiting on|waiting for others|who owes me|what are others doing|make my day easier|easy plan|low[- ]effort|quick wins?|weekly review|review my week|week recap|what did i promise|open commitments|what do i owe|what did i agree to)\b/i.test(text);
}

async function produceAgentAnswer(session: VoiceLiveSession, text: string, generation: number): Promise<void> {
  const result = await agentFn({ text, internalType: session.internalType, policy: session.policy, userId: session.userId, sessionId: session.sessionId });
  if (!(await canWrite(session, generation))) {
    console.debug("voice: ignored late agent result", { sessionId: session.sessionId });
    return;
  }
  if (result.kind === "provider_not_configured") {
    await persistOutput(session, "error", null, result.message ?? "Provider is not configured", "failed", { stage: "provider" });
    session.emit({ type: "error", stage: "provider", message: result.message ?? "Provider is not configured" });
    await transition(session, "listening");
    return;
  }
  const responseText = result.text ?? "";
  const speechId = randomUUID();
  await persistTurn(session, "assistant", "text", responseText, { speechId });
  await persistOutput(session, "assistant_text", speechId, responseText, "emitted");
  await logBrainAuditEvent({
    userId: session.userId,
    sessionId: session.sessionId,
    eventType: "assistant_text",
    payload: { chars: responseText.length, policy: session.policy },
  }).catch(() => null);
  session.emit({ type: "voice_assistant_text", text: responseText, speechId });
  await maybeSpeak(session, speechId, responseText, "screen");
}

async function ingestVoiceTranscript(session: VoiceLiveSession, seg: BufferedSegment): Promise<void> {
  const transcriptReceivedAt = Date.now();
  if (!(await canWrite(session, session.generation))) return;
  await db.insert(transcriptSegments).values({
    sessionId: session.sessionId,
    speaker: seg.speaker,
    text: seg.text,
    isFinal: true,
    offsetMs: seg.offsetMs,
    confidence: seg.confidence ?? null,
  });
  await persistTurn(session, "user", "transcript", seg.text, { speaker: seg.speaker, offsetMs: seg.offsetMs });
  await pushSegment(session.sessionId, seg);
  await logBrainAuditEvent({
    userId: session.userId,
    sessionId: session.sessionId,
    eventType: "transcript",
    payload: { speaker: seg.speaker, chars: seg.text.length, offsetMs: seg.offsetMs, policy: session.policy },
  }).catch(() => null);
  session.emit({ type: "voice_segment", speaker: seg.speaker, text: seg.text, isFinal: true });
  const triggers = classifySegment({ speaker: seg.speaker, text: seg.text }, session.internalType);
  if (triggers.length === 0) return;
  session.emit({ type: "voice_triggers", triggers });
  if (session.policy !== "whisper_copilot") return;
  const cueDecision = generateFastCue({ internalType: session.internalType, text: seg.text, triggers });
  if (!cueDecision) return;
  if (!(await tryAcquireFastCueSlot(session.sessionId, `voice:${cueDecision.key}`))) return;
  const cue = enforceCueForPolicy(cueDecision.cue, session.policy);
  const speechId = randomUUID();
  if (!(await canWrite(session, session.generation))) return;
  await db.insert(cueEvents).values({ sessionId: session.sessionId, triggerType: triggers[0]?.type ?? "risk_phrase", cue });
  await logBrainAuditEvent({
    userId: session.userId,
    sessionId: session.sessionId,
    eventType: "transcript_cue",
    payload: { triggerType: triggers[0]?.type ?? "risk_phrase", cueKind: cue.kind, urgency: cue.urgency, policy: session.policy },
  }).catch(() => null);
  await persistTurn(session, "cue", "cue", cue.spokenCue, { triggers });
  await persistOutput(session, "cue", speechId, cue.spokenCue, "emitted", { cue });
  const cueEmittedAt = Date.now();
  await persistEvaluation({
    userId: session.userId,
    sessionId: session.sessionId,
    result: evaluateCueQuality({
      cueText: cue.spokenCue,
      targetId: speechId,
      transcriptReceivedAt,
      cueEmittedAt,
      delivery: cue.delivery,
      source: "deterministic",
    }),
  }).catch(() => null);
  session.emit({ type: "voice_cue", cue, speechId });
  await maybeSpeak(session, speechId, cue.spokenCue, cue.delivery);
  const researchNeed = detectResearchNeed({ text: seg.text, internalType: session.internalType, livePolicy: session.policy });
  if (researchNeed.needsResearch) {
    await startVoiceResearchSubagent(session, seg.text, session.generation, "screen_only");
  }
}

async function startVoiceResearchSubagent(session: VoiceLiveSession, query: string, generation: number, liveDelivery: "screen_only" | "main_agent_summary"): Promise<void> {
  const task = await startResearchSubagent({
    userId: session.userId,
    sessionId: session.sessionId,
    situationBriefId: session.situationBriefId,
    query,
    internalType: session.internalType,
    trigger: session.policy === "whisper_copilot" ? "voice_session_side_channel" : "research_needed",
    liveDelivery,
    priority: session.policy === "whisper_copilot" ? "low" : "normal",
    onProgress: (progress) => {
      void emitSubagentProgress(session, generation, progress.taskId, progress.kind, progress.status, progress.message, liveDelivery);
    },
  });
  if (!(await canWrite(session, generation))) return;
  session.emit({ type: "voice_subagent_started", taskId: task.id, kind: task.kind, title: "Checking sources" });
  void watchSubagentReport(session, generation, task.id, task.kind, liveDelivery);
}

async function emitSubagentProgress(
  session: VoiceLiveSession,
  generation: number,
  taskId: string,
  kind: string,
  status: string,
  message: string,
  liveDelivery: "screen_only" | "main_agent_summary",
): Promise<void> {
  if (!(await canWrite(session, generation))) return;
  if (status === "running") {
    session.emit({ type: "voice_subagent_progress", taskId, status: "running", message });
    return;
  }
  await emitSubagentReport(session, generation, taskId, kind, liveDelivery);
}

async function watchSubagentReport(
  session: VoiceLiveSession,
  generation: number,
  taskId: string,
  kind: string,
  liveDelivery: "screen_only" | "main_agent_summary",
): Promise<void> {
  const deadline = Date.now() + Math.max(config.SUBAGENT_RESEARCH_TIMEOUT_MS, config.SUBAGENT_DEFAULT_TIMEOUT_MS) + 1000;
  while (Date.now() < deadline) {
    if (session.emittedSubagentReports.has(taskId) || !(await canWrite(session, generation))) return;
    if (await emitSubagentReport(session, generation, taskId, kind, liveDelivery)) return;
    await sleep(150);
  }
}

async function emitSubagentReport(
  session: VoiceLiveSession,
  generation: number,
  taskId: string,
  kind: string,
  liveDelivery: "screen_only" | "main_agent_summary",
): Promise<boolean> {
  if (session.emittedSubagentReports.has(taskId)) return true;
  const report = await getOwnedSubagentReport(session.userId, taskId);
  if (!report || !(await canWrite(session, generation))) return false;
  session.emittedSubagentReports.add(taskId);
  const payload = {
    title: report.title,
    summary: report.summary,
    findings: report.findings as never,
    safetyNotes: report.safetyNotes as never,
    providerStatus: report.providerStatus as never,
  };
  if (report.status === "failed") {
    session.emit({ type: "voice_subagent_failed", taskId, kind, message: report.recommendedMainAgentMessage ?? report.summary });
  }
  session.emit({ type: "voice_subagent_report", taskId, kind, report: payload, delivery: liveDelivery === "screen_only" ? "screen_only" : "main_agent_summary" });
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function immediateResearchHoldingAnswer(session: VoiceLiveSession): string {
  const questions = getPlaybooks(session.internalType)
    .flatMap((playbook) => playbook.prepQuestions)
    .slice(0, 4)
    .join("; ");
  return `I'll check sources in the background. For now, ask these key questions: ${questions}.`;
}

async function maybeSpeak(session: VoiceLiveSession, speechId: string, text: string, delivery: Cue["delivery"]): Promise<void> {
  if (session.outputKind === "text") {
    await transition(session, "listening");
    return;
  }
  const provider = createTtsProvider();
  for (const event of provider.requestSpeech({ speechId, text, delivery })) {
    if (!(await canWrite(session, session.generation))) return;
    if (event.type === "voice_speak_request") {
      await persistOutput(session, "speak_request", event.speechId, event.text, "emitted", { delivery: event.delivery });
      await db.update(voiceSessions).set({ currentSpeechId: speechId, updatedAt: new Date() }).where(eq(voiceSessions.sessionId, session.sessionId));
      session.state.startSpeech(speechId);
    } else if (event.type === "voice_tts_unavailable") {
      await persistOutput(session, "tts_unavailable", event.speechId, event.message, "failed", { provider: event.provider });
    }
    session.emit(event);
  }
}

async function cancelSpeech(session: VoiceLiveSession, reason: "barge_in" | "client_cancel" | "stop"): Promise<void> {
  const speechId = session.state.cancelSpeech();
  if (!speechId) return;
  await db.update(voiceOutputs).set({ status: "canceled" }).where(and(eq(voiceOutputs.sessionId, session.sessionId), eq(voiceOutputs.speechId, speechId)));
  await persistOutput(session, "cancel_speech", speechId, null, "emitted", { reason });
  await db.update(voiceSessions).set({ state: "listening", currentSpeechId: null, updatedAt: new Date() }).where(eq(voiceSessions.sessionId, session.sessionId));
  session.emit({ type: "voice_cancel_speech", speechId, reason });
}

async function stopVoiceSession(session: VoiceLiveSession, save: boolean): Promise<void> {
  await cancelSpeech(session, "stop");
  session.active = false;
  session.generation++;
  const storedMemoryIds = await stopSession(session.sessionId, save);
  const state = save ? "stopped" : "discarded";
  await db.update(voiceSessions).set({ state, currentSpeechId: null, updatedAt: new Date() }).where(eq(voiceSessions.sessionId, session.sessionId));
  if (!save) await deleteVoiceContent(session.sessionId);
  if (save) session.emit({ type: "summary", storedMemoryIds });
  await clearSession(session.sessionId);
  live.delete(session.sessionId);
}

async function interruptVoiceSession(session: VoiceLiveSession): Promise<void> {
  session.active = false;
  session.generation++;
  await cancelSubagentsForSession(session.sessionId).catch(() => undefined);
  await db.update(sessions).set({ status: "interrupted", endedAt: new Date() }).where(eq(sessions.id, session.sessionId));
  await db.update(voiceSessions).set({ state: "interrupted", currentSpeechId: null, updatedAt: new Date() }).where(eq(voiceSessions.sessionId, session.sessionId));
  const [base] = await db.select({ retentionPolicy: sessions.retentionPolicy }).from(sessions).where(eq(sessions.id, session.sessionId)).limit(1);
  await deleteAdaptiveSessionArtifacts(session.sessionId);
  if (base?.retentionPolicy === "discard_on_stop") {
    await deleteSessionSensitiveContent(session.sessionId);
    await deleteVoiceContent(session.sessionId);
  }
  await clearSession(session.sessionId);
  live.delete(session.sessionId);
}

async function transition(session: VoiceLiveSession, next: "listening" | "thinking" | "speaking" | "stopped" | "interrupted" | "discarded"): Promise<void> {
  session.state.transition(next);
  await db.update(voiceSessions).set({ state: next, currentSpeechId: session.state.currentSpeechId, updatedAt: new Date() }).where(eq(voiceSessions.sessionId, session.sessionId));
  session.emit({ type: "voice_state", state: next });
}

async function persistTurn(session: VoiceLiveSession, role: "user" | "assistant" | "system" | "cue", channel: "text" | "transcript" | "cue" | "error", content: string, metadata?: unknown): Promise<void> {
  if (!(await canWrite(session, session.generation))) return;
  await db.insert(agentTurns).values({ sessionId: session.sessionId, userId: session.userId, role, channel, content, metadata: metadata ?? null });
}

async function persistOutput(session: VoiceLiveSession, outputType: VoiceOutputType, speechId: string | null, text: string | null, status: "queued" | "emitted" | "canceled" | "failed", metadata?: unknown): Promise<void> {
  if (!(await canWrite(session, session.generation))) return;
  await db.insert(voiceOutputs).values({ sessionId: session.sessionId, userId: session.userId, outputType, speechId, text, status, metadata: metadata ?? null });
}

async function canWrite(session: VoiceLiveSession, generation: number): Promise<boolean> {
  if (!session.active || session.generation !== generation) return false;
  const [row] = await db.select({ status: sessions.status }).from(sessions).where(eq(sessions.id, session.sessionId)).limit(1);
  return row?.status === "active";
}

async function getBaseSession(userId: string, sessionId: string): Promise<{ situationBriefId: string | null; internalType: InternalType } | null> {
  const [row] = await db
    .select({ situationBriefId: sessions.situationBriefId, internalType: sessions.internalType })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);
  return row ?? null;
}

async function deleteSessionSensitiveContent(sessionId: string): Promise<void> {
  await db.delete(transcriptSegments).where(eq(transcriptSegments.sessionId, sessionId));
  await db.delete(suggestions).where(eq(suggestions.sessionId, sessionId));
  await db.delete(cueEvents).where(eq(cueEvents.sessionId, sessionId));
}

async function deleteVoiceContent(sessionId: string): Promise<void> {
  await db.delete(agentTurns).where(eq(agentTurns.sessionId, sessionId));
  await db.delete(voiceOutputs).where(eq(voiceOutputs.sessionId, sessionId));
}

async function deleteAdaptiveSessionArtifacts(sessionId: string): Promise<void> {
  await db.delete(humanProfileFacts).where(eq(humanProfileFacts.sourceSessionId, sessionId));
  await db.delete(brainReflections).where(eq(brainReflections.sessionId, sessionId));
}

function rawDataToBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}

export async function getOwnedVoiceSession(userId: string, sessionId: string) {
  const [row] = await db.select().from(voiceSessions).where(and(eq(voiceSessions.sessionId, sessionId), eq(voiceSessions.userId, userId))).limit(1);
  return row ?? null;
}

export async function getOwnedTurns(userId: string, sessionId: string) {
  if (!(await getOwnedVoiceSession(userId, sessionId))) return null;
  return db.select().from(agentTurns).where(eq(agentTurns.sessionId, sessionId)).orderBy(asc(agentTurns.createdAt));
}

export async function getOwnedVoiceOutputs(userId: string, sessionId: string) {
  if (!(await getOwnedVoiceSession(userId, sessionId))) return null;
  return db.select().from(voiceOutputs).where(eq(voiceOutputs.sessionId, sessionId)).orderBy(asc(voiceOutputs.createdAt));
}
