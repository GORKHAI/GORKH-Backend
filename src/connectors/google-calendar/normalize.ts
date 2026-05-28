import type { ConnectorItemType, Sensitivity } from "../../db/schema.js";
import { classifyCalendarSensitivity, redactCalendarDescription, sanitizeCalendarMetadata } from "./privacy.js";

export interface GoogleCalendarEventInput {
  id?: string;
  summary?: string | null;
  description?: string | null;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  status?: string;
  eventType?: string;
  attendees?: unknown[];
}

export interface NormalizedGoogleCalendarItem {
  provider: "google_calendar";
  itemType: ConnectorItemType;
  externalId: string;
  title: string;
  summary: string | null;
  startsAt: string | null;
  endsAt: string | null;
  metadata: Record<string, unknown>;
  sensitivity: Sensitivity;
}

export function normalizeGoogleCalendarEvent(input: GoogleCalendarEventInput): NormalizedGoogleCalendarItem {
  const start = input.start?.dateTime ?? input.start?.date ?? null;
  const end = input.end?.dateTime ?? input.end?.date ?? null;
  return {
    provider: "google_calendar",
    itemType: "calendar_event",
    externalId: input.id ?? `google-calendar-${start ?? "undated"}-${input.summary ?? "untitled"}`,
    title: input.summary ?? "Untitled calendar event",
    summary: redactCalendarDescription(input.description),
    startsAt: start,
    endsAt: end,
    metadata: sanitizeCalendarMetadata(input as Record<string, unknown>),
    sensitivity: classifyCalendarSensitivity(input),
  };
}
