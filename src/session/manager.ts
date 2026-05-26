import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  consentEvents,
  cueEvents,
  agentTurns,
  brainReflections,
  humanProfileFacts,
  sessions,
  situationBriefs,
  suggestions,
  subagentReports,
  subagentTasks,
  transcriptSegments,
  voiceOutputs,
  voiceSessions,
  type InternalType,
  type RetentionPolicy,
} from "../db/schema.js";
import {
  clearSession,
  pushSegment,
  readContext,
  tryAcquireFastCueSlot,
  tryAcquireSuggestionSlot,
  type BufferedSegment,
} from "../redis.js";
import { generateFastCue, type Cue } from "../cue/fast-cues.js";
import { buildSituationBrief, getOwnedSituationBrief } from "../situation/brief.js";
import { classifySegment, maxPriority, type TriggerEvent } from "../trigger/classifier.js";
import { extractAndStore } from "../memory/extract.js";
import { listKnownSubjects, searchMemories, type RetrievedMemory } from "../memory/store.js";
import { suggest, type SuggestionCard } from "../suggest/engine.js";
import { reflectOnSavedSession } from "../brain/reflection.js";
import { deleteDailySessionArtifacts, processSavedSessionDailyLife } from "../daily/session-daily.js";
import { logBrainAuditEvent } from "../brain/audit.js";
import { cancelSubagentsForSession } from "../subagents/scheduler.js";

export type OutboundEvent =
  | { type: "ack"; sessionId: string; situationBriefId: string | null; internalType: InternalType }
  | { type: "segment"; speaker: string; text: string; isFinal: boolean }
  | { type: "triggers"; triggers: TriggerEvent[] }
  | { type: "cue"; cue: Cue; triggers: TriggerEvent[] }
  | { type: "suggestion"; card: SuggestionCard; triggers: TriggerEvent[] }
  | { type: "summary"; storedMemoryIds: string[] }
  | { type: "error"; stage: string; message: string };

export type Emit = (event: OutboundEvent) => void;

export interface ConsentPayload {
  granted: boolean;
  method: string;
  noticeText: string;
  participantCount?: number | null;
  jurisdiction?: string | null;
}

interface LiveSession {
  sessionId: string;
  userId: string;
  situationBriefId: string | null;
  internalType: InternalType;
  retentionPolicy: RetentionPolicy;
  knownSubjects: string[];
  emit: Emit;
  active: boolean;
  generation: number;
}

const live = new Map<string, LiveSession>();

type SuggestionFn = typeof suggest;
type ExtractFn = typeof extractAndStore;

const defaultJobs = {
  suggest,
  extractAndStore,
};

let jobs: { suggest: SuggestionFn; extractAndStore: ExtractFn } = { ...defaultJobs };

export function setSessionJobOverridesForTest(overrides: Partial<typeof jobs>): void {
  jobs = { ...jobs, ...overrides };
}

export function resetSessionJobOverridesForTest(): void {
  jobs = { ...defaultJobs };
}

export async function startSession(args: {
  userId: string;
  situationBriefId?: string | null;
  situationDescription?: string | null;
  consent: ConsentPayload;
  title?: string | null;
  retentionPolicy: RetentionPolicy;
  emit: Emit;
}): Promise<string> {
  if (args.consent.granted !== true) {
    args.emit({ type: "error", stage: "consent", message: "Live assist cannot start without explicit consent." });
    throw new Error("Live assist cannot start without explicit consent.");
  }

  let situationBriefId: string | null = null;
  let internalType: InternalType;
  if (args.situationBriefId) {
    const brief = await getOwnedSituationBrief(args.userId, args.situationBriefId);
    if (!brief) throw new Error("Situation brief not found");
    situationBriefId = brief.id;
    internalType = brief.inferredType;
  } else {
    const built = buildSituationBrief({ description: args.situationDescription ?? "General live assist session" });
    const [brief] = await db
      .insert(situationBriefs)
      .values({
        userId: args.userId,
        description: built.description,
        inferredType: built.inferredType,
        userGoal: null,
        participants: null,
        scheduledAt: null,
        playbookIds: built.playbookIds,
        riskLevel: built.riskLevel,
      })
      .returning();
    if (!brief) throw new Error("failed to create situation brief");
    situationBriefId = brief.id;
    internalType = brief.inferredType;
  }

  const [session] = await db
    .insert(sessions)
    .values({
      userId: args.userId,
      situationBriefId,
      internalType,
      status: "active",
      title: args.title ?? null,
      consentGranted: true,
      retentionPolicy: args.retentionPolicy,
    })
    .returning({ id: sessions.id });
  if (!session) throw new Error("failed to create session");

  await db.insert(consentEvents).values({
    sessionId: session.id,
    userId: args.userId,
    granted: true,
    method: args.consent.method,
    noticeText: args.consent.noticeText,
    participantCount: args.consent.participantCount ?? null,
    jurisdiction: args.consent.jurisdiction ?? null,
  });

  let knownSubjects: string[] = [];
  try {
    knownSubjects = await listKnownSubjects(args.userId);
  } catch {
    knownSubjects = [];
  }

  live.set(session.id, {
    sessionId: session.id,
    userId: args.userId,
    situationBriefId,
    internalType,
    retentionPolicy: args.retentionPolicy,
    knownSubjects,
    emit: args.emit,
    active: true,
    generation: 0,
  });
  args.emit({ type: "ack", sessionId: session.id, situationBriefId, internalType });
  return session.id;
}

export function attach(sessionId: string, emit: Emit): boolean {
  const session = live.get(sessionId);
  if (!session || !session.active) return false;
  session.emit = emit;
  return true;
}

export function isLive(sessionId: string): boolean {
  return live.get(sessionId)?.active === true;
}

export async function ingestFinalSegment(sessionId: string, seg: BufferedSegment): Promise<void> {
  const session = live.get(sessionId);
  if (!session?.active) throw new Error(`no active session ${sessionId}`);

  await db.insert(transcriptSegments).values({
    sessionId,
    speaker: seg.speaker,
    text: seg.text,
    isFinal: true,
    offsetMs: seg.offsetMs,
    confidence: seg.confidence ?? null,
  });
  await logBrainAuditEvent({
    userId: session.userId,
    sessionId,
    eventType: "transcript",
    payload: { speaker: seg.speaker, chars: seg.text.length, offsetMs: seg.offsetMs },
  }).catch(() => null);
  await pushSegment(sessionId, seg);
  if (!session.active) return;
  session.emit({ type: "segment", speaker: seg.speaker, text: seg.text, isFinal: true });

  const triggers = classifySegment({ speaker: seg.speaker, text: seg.text }, session.internalType, session.knownSubjects);
  if (triggers.length === 0) return;
  session.emit({ type: "triggers", triggers });

  const cueDecision = generateFastCue({ internalType: session.internalType, text: seg.text, triggers });
  if (cueDecision && (await tryAcquireFastCueSlot(sessionId, cueDecision.key))) {
    if (!session.active || !(await canWriteSession(sessionId, session.generation))) return;
    await db.insert(cueEvents).values({ sessionId, triggerType: triggers[0]?.type ?? "risk_phrase", cue: cueDecision.cue });
    if (!(await canWriteSession(sessionId, session.generation))) {
      await db.delete(cueEvents).where(eq(cueEvents.sessionId, sessionId));
      return;
    }
    await logBrainAuditEvent({
      userId: session.userId,
      sessionId,
      eventType: "transcript_cue",
      payload: { triggerType: triggers[0]?.type ?? "risk_phrase", cueKind: cueDecision.cue.kind, urgency: cueDecision.cue.urgency },
    }).catch(() => null);
    session.emit({ type: "cue", cue: cueDecision.cue, triggers });
  }

  if (maxPriority(triggers) < 2) return;
  if (!(await tryAcquireSuggestionSlot(sessionId))) return;
  const generation = session.generation;
  void produceSuggestion(session, triggers, generation).catch((err) => {
    if (session.active && live.get(session.sessionId) === session) {
      session.emit({ type: "error", stage: "suggestion", message: String((err as Error).message ?? err) });
    }
  });
}

async function produceSuggestion(session: LiveSession, triggers: TriggerEvent[], generation: number): Promise<void> {
  const context = await readContext(session.sessionId);
  let memory: RetrievedMemory[] = [];
  const subject = triggers.find((t) => t.type === "known_subject" && t.subject)?.subject;
  const query = subject ?? context.at(-1)?.text ?? "";
  if (query) {
    try {
      memory = await searchMemories(session.userId, query, 4);
    } catch {
      memory = [];
    }
  }
  const card = await jobs.suggest({ internalType: session.internalType, context, triggers, memory });
  const current = live.get(session.sessionId);
  if (!current?.active || current.generation !== generation || !(await canWriteSession(session.sessionId, generation))) {
    console.debug("session: ignored late suggestion result", { sessionId: session.sessionId });
    return;
  }
  await db.insert(suggestions).values({ sessionId: session.sessionId, triggerType: triggers[0]?.type ?? "risk_phrase", card });
  if (!current.active || live.get(session.sessionId) !== current) return;
  current.emit({ type: "suggestion", card, triggers });
}

export async function stopSession(sessionId: string, save: boolean): Promise<string[]> {
  const session = live.get(sessionId);
  if (!session) return [];
  session.active = false;
  session.generation++;
  let storedMemoryIds: string[] = [];

  if (!save) {
    await cancelSubagentsForSession(sessionId).catch(() => undefined);
    await db.transaction(async (tx) => {
      await tx.update(sessions).set({ status: "discarded", endedAt: new Date() }).where(eq(sessions.id, sessionId));
      await tx.update(subagentTasks).set({ status: "suppressed", completedAt: new Date(), error: "session_discarded" }).where(eq(subagentTasks.sessionId, sessionId));
      await tx.delete(subagentReports).where(eq(subagentReports.sessionId, sessionId));
      await tx.delete(humanProfileFacts).where(eq(humanProfileFacts.sourceSessionId, sessionId));
      await tx.delete(brainReflections).where(eq(brainReflections.sessionId, sessionId));
      await tx.delete(transcriptSegments).where(eq(transcriptSegments.sessionId, sessionId));
      await tx.delete(suggestions).where(eq(suggestions.sessionId, sessionId));
      await tx.delete(cueEvents).where(eq(cueEvents.sessionId, sessionId));
      await tx.delete(agentTurns).where(eq(agentTurns.sessionId, sessionId));
      await tx.delete(voiceOutputs).where(eq(voiceOutputs.sessionId, sessionId));
    });
    await deleteDailySessionArtifacts(sessionId).catch(() => undefined);
    await clearSession(sessionId);
    live.delete(sessionId);
    return [];
  }

  await db.update(sessions).set({ status: "saved", endedAt: new Date() }).where(eq(sessions.id, sessionId));
  const transcript = await readPersistedTranscript(sessionId);
  try {
    storedMemoryIds = await jobs.extractAndStore({ userId: session.userId, sessionId, transcript });
  } catch (err) {
    session.emit({ type: "error", stage: "extract", message: String((err as Error).message ?? err) });
  }
  try {
    await reflectOnSavedSession({ userId: session.userId, sessionId, transcript });
  } catch (err) {
    session.emit({ type: "error", stage: "reflection", message: String((err as Error).message ?? err) });
  }
  try {
    await processSavedSessionDailyLife({ userId: session.userId, sessionId, internalType: session.internalType });
  } catch (err) {
    session.emit({ type: "error", stage: "daily_life", message: String((err as Error).message ?? err) });
  }
  session.emit({ type: "summary", storedMemoryIds });
  await clearSession(sessionId);
  live.delete(sessionId);
  return storedMemoryIds;
}

export async function interruptSession(sessionId: string): Promise<void> {
  const session = live.get(sessionId);
  if (!session) return;
  session.active = false;
  session.generation++;
  await cancelSubagentsForSession(sessionId).catch(() => undefined);
  if (session.retentionPolicy === "discard_on_stop") await deleteSessionContent(sessionId);
  await db.update(sessions).set({ status: "interrupted", endedAt: new Date() }).where(eq(sessions.id, sessionId));
  await deleteAdaptiveSessionArtifacts(sessionId);
  await clearSession(sessionId);
  live.delete(sessionId);
}

async function canWriteSession(sessionId: string, generation: number): Promise<boolean> {
  const session = live.get(sessionId);
  if (!session?.active || session.generation !== generation) return false;
  const [row] = await db
    .select({ status: sessions.status })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  return row?.status === "active";
}

async function readPersistedTranscript(sessionId: string): Promise<BufferedSegment[]> {
  const rows = await db
    .select({
      speaker: transcriptSegments.speaker,
      text: transcriptSegments.text,
      offsetMs: transcriptSegments.offsetMs,
      confidence: transcriptSegments.confidence,
      createdAt: transcriptSegments.createdAt,
    })
    .from(transcriptSegments)
    .where(eq(transcriptSegments.sessionId, sessionId))
    .orderBy(asc(transcriptSegments.offsetMs), asc(transcriptSegments.createdAt));
  return rows.map((row) => ({
    speaker: row.speaker,
    text: row.text,
    offsetMs: row.offsetMs,
    confidence: row.confidence,
    createdAt: row.createdAt.toISOString(),
  }));
}

async function deleteSessionContent(sessionId: string): Promise<void> {
  await cancelSubagentsForSession(sessionId).catch(() => undefined);
  await deleteAdaptiveSessionArtifacts(sessionId);
  await db.delete(transcriptSegments).where(eq(transcriptSegments.sessionId, sessionId));
  await db.delete(suggestions).where(eq(suggestions.sessionId, sessionId));
  await db.delete(cueEvents).where(eq(cueEvents.sessionId, sessionId));
  await db.delete(agentTurns).where(eq(agentTurns.sessionId, sessionId));
  await db.delete(voiceOutputs).where(eq(voiceOutputs.sessionId, sessionId));
}

async function deleteAdaptiveSessionArtifacts(sessionId: string): Promise<void> {
  await db.delete(humanProfileFacts).where(eq(humanProfileFacts.sourceSessionId, sessionId));
  await db.delete(brainReflections).where(eq(brainReflections.sessionId, sessionId));
  await deleteDailySessionArtifacts(sessionId);
}

export async function markVoiceSessionState(sessionId: string, state: "stopped" | "interrupted" | "discarded"): Promise<void> {
  await db.update(voiceSessions).set({ state, updatedAt: new Date(), currentSpeechId: null }).where(eq(voiceSessions.sessionId, sessionId));
}

export async function sessionBelongsToUser(userId: string, sessionId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);
  return Boolean(row);
}
