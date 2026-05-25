import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { sessions, transcriptSegments, suggestions, type SessionMode } from "../db/schema.js";
import {
  pushSegment,
  readContext,
  clearSession,
  tryAcquireSuggestionSlot,
  type BufferedSegment,
} from "../redis.js";
import { classifySegment, maxPriority, type TriggerEvent } from "../trigger/classifier.js";
import { searchMemories, listKnownSubjects, type RetrievedMemory } from "../memory/store.js";
import { suggest, type SuggestionCard } from "../suggest/engine.js";
import { extractAndStore } from "../memory/extract.js";

/** Events the manager pushes back toward the client. */
export type OutboundEvent =
  | { type: "ack"; sessionId: string }
  | { type: "segment"; speaker: string; text: string; isFinal: boolean }
  | { type: "triggers"; triggers: TriggerEvent[] }
  | { type: "suggestion"; card: SuggestionCard; triggers: TriggerEvent[] }
  | { type: "summary"; storedMemoryIds: string[] }
  | { type: "error"; stage: string; message: string };

type Emit = (e: OutboundEvent) => void;

interface LiveSession {
  sessionId: string;
  userId: string;
  mode: SessionMode;
  knownSubjects: string[];
  emit: Emit;
}

const live = new Map<string, LiveSession>();

/** Begin a live session. Creates (or reuses) the DB row and caches state. */
export async function startSession(args: {
  userId: string;
  mode: SessionMode;
  consentGranted: boolean;
  emit: Emit;
  title?: string;
}): Promise<string> {
  const [row] = await db
    .insert(sessions)
    .values({
      userId: args.userId,
      mode: args.mode,
      consentGranted: args.consentGranted,
      title: args.title ?? null,
      status: "active",
    })
    .returning({ id: sessions.id });
  if (!row) throw new Error("failed to create session");

  let knownSubjects: string[] = [];
  try {
    knownSubjects = await listKnownSubjects(args.userId);
  } catch {
    // memory subjects are an optimisation; absence must not block a session
    knownSubjects = [];
  }

  live.set(row.id, {
    sessionId: row.id,
    userId: args.userId,
    mode: args.mode,
    knownSubjects,
    emit: args.emit,
  });
  args.emit({ type: "ack", sessionId: row.id });
  return row.id;
}

/** Re-attach an emit callback to an existing live session (e.g. ws reconnect). */
export function attach(sessionId: string, emit: Emit): boolean {
  const s = live.get(sessionId);
  if (!s) return false;
  s.emit = emit;
  return true;
}

/**
 * The convergence point. Both the Deepgram audio path and the replay/test path
 * call this with a FINAL transcript segment.
 */
export async function ingestFinalSegment(
  sessionId: string,
  seg: BufferedSegment,
): Promise<void> {
  const s = live.get(sessionId);
  if (!s) throw new Error(`no live session ${sessionId}`);

  // 1) Persist + buffer (always, regardless of triggers).
  await db.insert(transcriptSegments).values({
    sessionId,
    speaker: seg.speaker,
    text: seg.text,
    isFinal: true,
    offsetMs: seg.offsetMs,
  });
  await pushSegment(sessionId, seg);
  s.emit({ type: "segment", speaker: seg.speaker, text: seg.text, isFinal: true });

  // 2) Classify (cheap, local, synchronous).
  const triggers = classifySegment(
    { speaker: seg.speaker, text: seg.text },
    s.mode,
    s.knownSubjects,
  );
  if (triggers.length === 0) return;
  s.emit({ type: "triggers", triggers });

  // 3) Only spend an LLM call for priority>=2 events, and respect the cooldown.
  if (maxPriority(triggers) < 2) return;
  const slot = await tryAcquireSuggestionSlot(sessionId);
  if (!slot) return;

  // 4) Fire the suggestion off the hot path; surface real errors, never fake.
  void produceSuggestion(s, triggers).catch((err) => {
    s.emit({ type: "error", stage: "suggestion", message: String(err?.message ?? err) });
  });
}

async function produceSuggestion(s: LiveSession, triggers: TriggerEvent[]): Promise<void> {
  const context = await readContext(s.sessionId);

  // Retrieve memory: prefer an explicit known-subject trigger, else use the
  // latest utterance as the query.
  let memory: RetrievedMemory[] = [];
  const subjectTrigger = triggers.find((t) => t.type === "known_subject" && t.subject);
  const query = subjectTrigger?.subject ?? context[context.length - 1]?.text ?? "";
  if (query) {
    try {
      memory = await searchMemories(s.userId, query, 4);
    } catch {
      memory = []; // memory retrieval needs Voyage; degrade gracefully
    }
  }

  const card = await suggest({ mode: s.mode, context, triggers, memory });

  await db.insert(suggestions).values({
    sessionId: s.sessionId,
    triggerType: triggers[0]!.type,
    card,
  });
  s.emit({ type: "suggestion", card, triggers });
}

/**
 * Stop a session. If `save` is true, run memory extraction over the full
 * transcript before clearing volatile state. If false, discard everything.
 */
export async function stopSession(sessionId: string, save: boolean): Promise<string[]> {
  const s = live.get(sessionId);
  const context = await readContext(sessionId);
  let storedMemoryIds: string[] = [];

  if (save && s) {
    await db
      .update(sessions)
      .set({ status: "saved", endedAt: new Date() })
      .where(eq(sessions.id, sessionId));
    try {
      storedMemoryIds = await extractAndStore({
        userId: s.userId,
        sessionId,
        transcript: context,
      });
    } catch (err) {
      s.emit({ type: "error", stage: "extract", message: String((err as Error).message) });
    }
    s.emit({ type: "summary", storedMemoryIds });
  } else {
    await db
      .update(sessions)
      .set({ status: save ? "saved" : "discarded", endedAt: new Date() })
      .where(eq(sessions.id, sessionId));
    if (!save) {
      // Hard-delete the transcript for discarded sessions (privacy-first).
      await db.delete(transcriptSegments).where(eq(transcriptSegments.sessionId, sessionId));
    }
  }

  await clearSession(sessionId);
  live.delete(sessionId);
  return storedMemoryIds;
}

export function isLive(sessionId: string): boolean {
  return live.has(sessionId);
}
