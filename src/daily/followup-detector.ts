import { db } from "../db/client.js";
import { followupSuggestions, type FollowupSuggestion } from "../db/schema.js";

export function detectFollowupSuggestion(text: string): { reason: string; suggestedMessage: string | null; personName?: string | null; organizationName?: string | null } | null {
  if (!/\b(follow up|circle back|send (them|a) message|check in|reply by|next step)\b/i.test(text)) return null;
  const org = text.match(/\b(bank|clinic|doctor|client|lawyer|partner|team)\b/i)?.[1] ?? null;
  return {
    reason: "Conversation mentioned a follow-up or next-step message.",
    organizationName: org,
    suggestedMessage: "Thanks for the conversation. I wanted to confirm the next steps, owner, deadline, and any documents needed.",
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
      status: "proposed",
    })
    .returning();
  return row ?? null;
}
