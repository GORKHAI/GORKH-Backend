import type { ConnectorItemType, Sensitivity } from "../../db/schema.js";

export { normalizeGoogleCalendarEvent, type GoogleCalendarEventInput } from "../google-calendar/normalize.js";

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
