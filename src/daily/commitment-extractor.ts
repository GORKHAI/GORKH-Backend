import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { commitments, sessions, transcriptSegments, type Commitment, type InternalType } from "../db/schema.js";
import type { BufferedSegment } from "../redis.js";
import { sensitivityForDailyText, type CommitmentExtractionInput, type ProposedCommitment } from "./types.js";

const commitmentPatterns = [
  /\b(?:i will|i'll|i need to|i have to|i should|remember i need to)\s+(.+?)(?:[.!?]|$)/gi,
  /\bwe agreed\s+(?:to|that)\s+(.+?)(?:[.!?]|$)/gi,
  /\b(?:send|share|provide|upload|bring|prepare|confirm|follow up)\s+(.+?)(?:[.!?]|$)/gi,
  /\b(?:the doctor said|the bank asked for|client asked me to)\s+(.+?)(?:[.!?]|$)/gi,
  /\b(?:waiting on|waiting for)\s+(.+?)(?:[.!?]|$)/gi,
];

export function extractCommitmentsFromText(input: CommitmentExtractionInput): ProposedCommitment[] {
  const text = normalizeSpaces(input.text);
  if (!text || text.length < 6) return [];
  const dueAt = inferDueDate(text, input.now ?? new Date());
  const sensitivity = sensitivityForDailyText(text, input.internalType);
  const results: ProposedCommitment[] = [];
  for (const pattern of commitmentPatterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const raw = match[1]?.trim();
      if (!raw || isFalsePositive(raw)) continue;
      results.push({
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        owner: inferOwner(match[0] ?? "", input.speaker),
        counterparty: inferCounterparty(text),
        title: toTitle(raw),
        detail: text,
        dueAt,
        confidence: confidenceFor(match[0] ?? "", dueAt),
        sensitivity,
      });
    }
  }
  return dedupeCommitments(results).slice(0, 8);
}

export async function proposeCommitmentsFromSavedSession(args: {
  userId: string;
  sessionId: string;
  internalType: InternalType;
}): Promise<Commitment[]> {
  const [session] = await db
    .select({ status: sessions.status })
    .from(sessions)
    .where(and(eq(sessions.id, args.sessionId), eq(sessions.userId, args.userId)))
    .limit(1);
  if (session?.status !== "saved") return [];

  const rows = await db
    .select()
    .from(transcriptSegments)
    .where(eq(transcriptSegments.sessionId, args.sessionId))
    .orderBy(asc(transcriptSegments.offsetMs), asc(transcriptSegments.createdAt));
  const values = rows.flatMap((row) =>
    extractCommitmentsFromText({
      text: row.text,
      sourceType: "transcript",
      sourceId: row.id,
      internalType: args.internalType,
      speaker: row.speaker,
    }).map((commitment) => ({
      userId: args.userId,
      sessionId: args.sessionId,
      sourceType: commitment.sourceType,
      sourceId: commitment.sourceId ?? null,
      owner: commitment.owner ?? null,
      counterparty: commitment.counterparty ?? null,
      title: commitment.title,
      detail: commitment.detail ?? null,
      dueAt: commitment.dueAt ?? null,
      status: "proposed" as const,
      confidence: commitment.confidence,
      sensitivity: commitment.sensitivity,
    })),
  );
  if (values.length === 0) return [];
  return db.insert(commitments).values(values).returning();
}

export function transcriptToBufferedSegments(rows: Array<{ speaker: string; text: string; offsetMs: number; confidence: number | null; createdAt: Date }>): BufferedSegment[] {
  return rows.map((row) => ({
    speaker: row.speaker,
    text: row.text,
    offsetMs: row.offsetMs,
    confidence: row.confidence,
    createdAt: row.createdAt.toISOString(),
  }));
}

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isFalsePositive(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (/^(know|think|be|do|go|say|ask|maybe|probably|something|anything)$/.test(lower)) return true;
  if (/^(that|this|it|there)\b/.test(lower)) return true;
  if (/\b(maybe|someday|if possible|not sure)\b/.test(lower) && !/\bby|before|tomorrow|next week|follow up\b/.test(lower)) return true;
  return text.length < 5;
}

function inferOwner(match: string, speaker?: string | null): string | null {
  if (/^waiting (on|for)/i.test(match)) return inferCounterparty(match) ?? "other";
  if (/^we agreed/i.test(match)) return "we";
  if (/^client asked/i.test(match)) return "me";
  if (/^the (doctor|bank) asked/i.test(match)) return "me";
  if (/\bi('| wi)ll\b|\bi need to\b|\bi have to\b/i.test(match)) return "me";
  return speaker ?? null;
}

function inferCounterparty(text: string): string | null {
  if (/\bdoctor|clinic\b/i.test(text)) return "doctor";
  if (/\bbank|loan officer|lender\b/i.test(text)) return "bank";
  if (/\bclient\b/i.test(text)) return "client";
  if (/\blawyer|legal|solicitor|attorney\b/i.test(text)) return "lawyer";
  const waiting = text.match(/\bwaiting (?:on|for)\s+(?:the\s+)?([a-z][a-z -]{1,40}?)(?:\s+to|\s+for| by| before| next| tomorrow| today|[.!?]|$)/i);
  if (waiting?.[1]) return waiting[1].trim();
  return null;
}

function toTitle(raw: string): string {
  const cleaned = raw.replace(/\b(by|before|next week|tomorrow|today|on friday|on monday|on tuesday|on wednesday|on thursday|on saturday|on sunday).*$/i, "").trim();
  const sentence = cleaned.length > 0 ? cleaned : raw.trim();
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

function confidenceFor(match: string, dueAt: Date | null): number {
  let confidence = 0.68;
  if (/\bi will|i'll|we agreed|asked me to/i.test(match)) confidence += 0.16;
  if (dueAt) confidence += 0.08;
  return Math.min(0.92, confidence);
}

function inferDueDate(text: string, now: Date): Date | null {
  const lower = text.toLowerCase();
  const result = new Date(now);
  if (/\btoday\b/.test(lower)) return result;
  if (/\btomorrow\b/.test(lower)) {
    result.setUTCDate(result.getUTCDate() + 1);
    return result;
  }
  if (/\bnext week\b/.test(lower)) {
    result.setUTCDate(result.getUTCDate() + 7);
    return result;
  }
  const inDays = lower.match(/\bin\s+(\d{1,2})\s+days?\b/);
  if (inDays?.[1]) {
    result.setUTCDate(result.getUTCDate() + Number(inDays[1]));
    return result;
  }
  const weekday = lower.match(/\b(?:by|on|before)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (weekday?.[1]) return nextWeekday(now, weekday[1]);
  const iso = lower.match(/\b(?:by|on|before)\s+(\d{4}-\d{2}-\d{2})\b/);
  if (iso?.[1]) {
    const parsed = new Date(`${iso[1]}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function nextWeekday(now: Date, weekday: string): Date {
  const index = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(weekday);
  const result = new Date(now);
  const current = result.getUTCDay();
  const delta = ((index - current + 7) % 7) || 7;
  result.setUTCDate(result.getUTCDate() + delta);
  return result;
}

function dedupeCommitments(values: ProposedCommitment[]): ProposedCommitment[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = `${value.title.toLowerCase()}|${value.dueAt?.toISOString() ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
