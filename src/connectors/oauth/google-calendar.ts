import type { ConnectorItemType, Sensitivity } from "../../db/schema.js";

export interface NormalizedConnectorItemInput {
  provider: "google_calendar" | "google_gmail";
  itemType: ConnectorItemType;
  externalId: string;
  title?: string | null;
  summary?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  metadata?: Record<string, unknown>;
  sensitivity?: Sensitivity;
}

export function normalizeGoogleCalendarEvent(input: {
  id: string;
  summary?: string | null;
  description?: string | null;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}): NormalizedConnectorItemInput {
  return {
    provider: "google_calendar",
    itemType: "calendar_event",
    externalId: input.id,
    title: input.summary ?? "Untitled calendar event",
    summary: input.description ?? null,
    startsAt: input.start?.dateTime ?? input.start?.date ?? null,
    endsAt: input.end?.dateTime ?? input.end?.date ?? null,
    metadata: { source: "fixture_or_imported_google_calendar" },
    sensitivity: "medium",
  };
}
