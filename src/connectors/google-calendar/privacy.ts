import type { Sensitivity } from "../../db/schema.js";

const SECRET_METADATA_KEYS = new Set(["hangoutLink", "conferenceData", "creator", "organizer", "attendees", "htmlLink"]);

export function sanitizeCalendarMetadata(event: Record<string, unknown>): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    source: "google_calendar",
    status: typeof event.status === "string" ? event.status : undefined,
    eventType: typeof event.eventType === "string" ? event.eventType : undefined,
  };
  const attendees = Array.isArray(event.attendees) ? event.attendees : [];
  if (attendees.length > 0) metadata.attendeeCount = attendees.length;
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined && !SECRET_METADATA_KEYS.has(String(value))));
}

export function classifyCalendarSensitivity(event: { description?: string | null; summary?: string | null; attendees?: unknown[] | null }): Sensitivity {
  const text = `${event.summary ?? ""} ${event.description ?? ""}`.toLowerCase();
  if (/\b(doctor|clinic|hospital|therapy|legal|lawyer|attorney|bank|loan|mortgage|tax)\b/.test(text)) return "medium";
  if ((event.attendees?.length ?? 0) > 0) return "medium";
  return "low";
}

export function redactCalendarDescription(description?: string | null): string | null {
  if (!description) return null;
  return description.replace(/https?:\/\/\S+/g, "[link redacted]").slice(0, 500);
}
