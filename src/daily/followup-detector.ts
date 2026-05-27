import { db } from "../db/client.js";
import { followupSuggestions, type FollowupSuggestion } from "../db/schema.js";

export function detectFollowupSuggestion(text: string, now = new Date()): { reason: string; suggestedMessage: string | null; personName?: string | null; organizationName?: string | null; dueAt?: Date | null; channel?: string | null } | null {
  if (!/\b(follow up|circle back|send (them|a) message|check in|reply by|next step)\b/i.test(text)) return null;
  const org = text.match(/\b(bank|clinic|doctor|client|lawyer|partner|team)\b/i)?.[1] ?? null;
  return {
    reason: reasonFor(text),
    organizationName: org,
    suggestedMessage: draftMessageFor(org),
    dueAt: inferFollowupDueDate(text, now),
    channel: null,
  };
}

export async function proposeFollowup(args: { userId: string; sessionId?: string | null; text: string }): Promise<FollowupSuggestion | null> {
  const detected = detectFollowupSuggestion(args.text);
  if (!detected) return null;
  const [row] = await db
    .insert(followupSuggestions)
    .values({
      userId: args.userId,
      sessionId: args.sessionId ?? null,
      personName: detected.personName ?? null,
      organizationName: detected.organizationName ?? null,
      reason: detected.reason,
      suggestedMessage: detected.suggestedMessage,
      dueAt: detected.dueAt ?? null,
      channel: detected.channel ?? null,
      status: "proposed",
    })
    .returning();
  return row ?? null;
}

function reasonFor(text: string): string {
  if (/\bdeadline|due|by\b/i.test(text)) return "Conversation mentioned a follow-up with a time-sensitive deadline.";
  if (/\bnext step\b/i.test(text)) return "Conversation mentioned a next-step follow-up.";
  return "Conversation mentioned a follow-up or check-in.";
}

function draftMessageFor(org: string | null): string {
  const target = org ? ` ${org}` : "";
  return `Thanks for the conversation. I wanted to confirm the${target} next steps, owner, deadline, and any documents needed.`;
}

function inferFollowupDueDate(text: string, now: Date): Date | null {
  const lower = text.toLowerCase();
  const due = new Date(now);
  if (/\btoday\b/.test(lower)) return due;
  if (/\btomorrow\b/.test(lower)) {
    due.setUTCDate(due.getUTCDate() + 1);
    return due;
  }
  if (/\bnext week\b/.test(lower)) {
    due.setUTCDate(due.getUTCDate() + 7);
    return due;
  }
  return null;
}
