import { db } from "../db/client.js";
import { outreachComplianceEvents } from "../db/schema.js";
import type { OutreachComplianceResult } from "./types.js";

const deceptiveSubjectPatterns = [/re:\s*/i, /following up on our conversation/i, /as discussed/i, /urgent\b/i];
const fakeRelationshipPatterns = [/\b(great meeting|as we discussed|following our call|thanks for chatting)\b/i, /\bwarm intro\b/i];

export function checkOutboundCompliance(input: {
  subject: string;
  body: string;
  hasSourceBackedPersonalization: boolean;
  scaledCampaign?: boolean;
}): OutreachComplianceResult {
  const notes: string[] = [];
  const blockedReasons: string[] = [];
  if (!/unsubscribe|opt out|not relevant|do not want/i.test(input.body)) {
    blockedReasons.push("cold_outreach_missing_opt_out");
  }
  if (deceptiveSubjectPatterns.some((pattern) => pattern.test(input.subject))) {
    blockedReasons.push("deceptive_or_pressure_subject");
  }
  if (fakeRelationshipPatterns.some((pattern) => pattern.test(input.body))) {
    blockedReasons.push("possible_fake_relationship_claim");
  }
  if (!input.hasSourceBackedPersonalization) {
    notes.push("No source-backed investor-specific personalization; use generic relevance language.");
  }
  if (input.scaledCampaign) {
    notes.push("Legal/compliance review recommended before scaled outbound campaigns.");
  }
  notes.push("Draft-only. GORKH does not send email in v0.");
  return { ok: blockedReasons.length === 0, notes, blockedReasons };
}

export async function recordOutreachComplianceEvent(args: {
  userId: string;
  campaignId?: string | null;
  draftId?: string | null;
  eventType: string;
  payload: unknown;
}) {
  const [event] = await db
    .insert(outreachComplianceEvents)
    .values({
      userId: args.userId,
      campaignId: args.campaignId ?? null,
      draftId: args.draftId ?? null,
      eventType: args.eventType,
      payload: args.payload,
    })
    .returning();
  return event;
}
