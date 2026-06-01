import { and, asc, desc, eq } from "drizzle-orm";
import { createActionProposal } from "../actions/proposal.js";
import { db } from "../db/client.js";
import { roomSummaries, roomTranscriptSegments, rooms } from "../db/schema.js";
import { logRoomAuditEvent } from "./audit.js";

export async function generateRoomSummary(userId: string, roomId: string) {
  const [room] = await db.select().from(rooms).where(and(eq(rooms.id, roomId), eq(rooms.userId, userId))).limit(1);
  if (!room) return null;
  const segments = await db.select().from(roomTranscriptSegments).where(eq(roomTranscriptSegments.roomId, room.id)).orderBy(asc(roomTranscriptSegments.createdAt));
  if (segments.length === 0) return { error: "no_transcript", message: "No transcript is available. No summary was fabricated." } as const;
  const text = segments.map((segment) => `${segment.speakerLabel}: ${segment.text}`).join("\n");
  const decisions = extractLines(text, /\b(decided|decision|agreed)\b/i);
  const commitments = extractLines(text, /\b(i will|i'll|we will|we'll|send|share|follow up|provide)\b/i);
  const followups = extractLines(text, /\b(follow up|next step|send|share|circle back|email)\b/i);
  const summary = summarizeTranscript(segments.map((segment) => segment.text).join(" "));
  const draftFollowup = buildDraftFollowup(room.title, decisions, commitments, followups);
  const actionProposal = await createActionProposal(userId, {
    sourceType: "manual",
    actionType: "draft_followup_message",
    title: `Draft follow-up for ${room.title}`,
    description: "Draft-only post-call follow-up. GORKH will not send this message.",
    payload: {
      roomId: room.id,
      draftStoredInRoomSummary: true,
      counts: { decisions: decisions.length, commitments: commitments.length, followups: followups.length },
      sendDisabled: true,
      connectorRequired: "google_gmail_or_outlook_future",
    },
  });
  const [created] = await db
    .insert(roomSummaries)
    .values({
      roomId: room.id,
      summary,
      decisions,
      commitments,
      followups,
      draftFollowup,
      actionProposalId: actionProposal.id,
    })
    .returning();
  await logRoomAuditEvent({ roomId: room.id, userId, eventType: "room_summary_generated", payload: { summaryId: created?.id, actionProposalId: actionProposal.id } }).catch(() => null);
  return { summary: created, actionProposal };
}

export async function latestRoomSummary(userId: string, roomId: string) {
  const [room] = await db.select({ id: rooms.id }).from(rooms).where(and(eq(rooms.id, roomId), eq(rooms.userId, userId))).limit(1);
  if (!room) return null;
  const [summary] = await db.select().from(roomSummaries).where(eq(roomSummaries.roomId, room.id)).orderBy(desc(roomSummaries.createdAt)).limit(1);
  return summary ?? null;
}

function extractLines(text: string, pattern: RegExp): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => pattern.test(line))
    .slice(0, 8);
}

function summarizeTranscript(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= 480) return normalized;
  return `${normalized.slice(0, 477)}...`;
}

function buildDraftFollowup(title: string, decisions: string[], commitments: string[], followups: string[]): string {
  const bullets = [
    decisions.length ? `Decisions discussed: ${decisions.join(" | ")}` : "Decisions discussed: please review the transcript.",
    commitments.length ? `Commitments: ${commitments.join(" | ")}` : "Commitments: please confirm any commitments manually.",
    followups.length ? `Follow-ups: ${followups.join(" | ")}` : "Follow-ups: please confirm the next step.",
  ];
  return `Hi,\n\nThanks for the call about ${title}. Here is my draft recap:\n\n${bullets.map((item) => `- ${item}`).join("\n")}\n\nPlease correct anything I missed.\n\nBest`;
}
