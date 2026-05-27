import type { NormalizedConnectorItemInput } from "./google-calendar.js";

export function normalizeGmailMessage(input: { id: string; threadId?: string; subject?: string | null; snippet?: string | null; from?: string | null }): NormalizedConnectorItemInput {
  return {
    provider: "google_gmail",
    itemType: "email_message",
    externalId: input.id,
    title: input.subject ?? "Email message",
    summary: input.snippet ?? null,
    metadata: { threadId: input.threadId ?? null, from: input.from ?? null, source: "fixture_or_imported_gmail" },
    sensitivity: "medium",
  };
}
