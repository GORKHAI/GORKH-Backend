import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { voiceLatencyEvents } from "../db/schema.js";

export type VoiceLatencyEventType =
  | "transcript_received"
  | "asr_final"
  | "cue_generated"
  | "gateway_instruction"
  | "client_speech_started"
  | "assistant_text_generated"
  | "subagent_started"
  | "subagent_report";

export async function recordVoiceLatencyEvent(args: {
  userId: string;
  sessionId: string;
  eventType: VoiceLatencyEventType;
  speechId?: string | null;
  timestamp?: Date;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  await db
    .insert(voiceLatencyEvents)
    .values({
      userId: args.userId,
      sessionId: args.sessionId,
      eventType: args.eventType,
      speechId: args.speechId ?? null,
      timestamp: args.timestamp ?? new Date(),
      metadata: args.metadata ?? null,
    })
    .catch(() => undefined);
}

export async function latencySummaryForSession(userId: string, sessionId: string) {
  const rows = await db
    .select()
    .from(voiceLatencyEvents)
    .where(and(eq(voiceLatencyEvents.userId, userId), eq(voiceLatencyEvents.sessionId, sessionId)))
    .orderBy(asc(voiceLatencyEvents.timestamp));
  const first = (type: VoiceLatencyEventType) => rows.find((row) => row.eventType === type)?.timestamp ?? null;
  const firstBySpeech = new Map<string, Partial<Record<VoiceLatencyEventType, Date>>>();
  for (const row of rows) {
    if (!row.speechId) continue;
    const current = firstBySpeech.get(row.speechId) ?? {};
    current[row.eventType as VoiceLatencyEventType] ??= row.timestamp;
    firstBySpeech.set(row.speechId, current);
  }
  const cuePairs = [...firstBySpeech.values()].map((events) => diff(events.transcript_received ?? first("transcript_received"), events.cue_generated)).filter(isNumber);
  const instructionPairs = [...firstBySpeech.values()].map((events) => diff(events.cue_generated, events.gateway_instruction)).filter(isNumber);
  const speechPairs = [...firstBySpeech.values()].map((events) => diff(events.gateway_instruction, events.client_speech_started)).filter(isNumber);
  const assistantPairs = [...firstBySpeech.values()].map((events) => diff(events.transcript_received ?? first("transcript_received"), events.assistant_text_generated)).filter(isNumber);
  const subagentPairs = [...firstBySpeech.values()].map((events) => diff(events.subagent_started, events.subagent_report)).filter(isNumber);
  const asrToCueMs = average(cuePairs);
  const slowCueCount = cuePairs.filter((value) => value > 1200).length;
  return {
    asrToCueMs,
    cueToGatewayInstructionMs: average(instructionPairs),
    gatewayInstructionToClientSpeechMs: average(speechPairs),
    transcriptToAssistantTextMs: average(assistantPairs),
    subagentDurationMs: average(subagentPairs),
    cueCount: await cueCount(sessionId),
    slowCueCount,
    warnings: slowCueCount > 0 ? [`${slowCueCount} cue(s) exceeded target latency.`] : [],
  };
}

async function cueCount(sessionId: string): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(voiceLatencyEvents).where(and(eq(voiceLatencyEvents.sessionId, sessionId), eq(voiceLatencyEvents.eventType, "cue_generated")));
  return Number(row?.count ?? 0);
}

function diff(start?: Date | null, end?: Date | null): number | null {
  if (!start || !end) return null;
  return Math.max(0, end.getTime() - start.getTime());
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function isNumber(value: number | null): value is number {
  return typeof value === "number";
}
