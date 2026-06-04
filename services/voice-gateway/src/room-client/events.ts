export type RoomLogEvent =
  | "room_loaded"
  | "consent_granted"
  | "consent_denied"
  | "token_received"
  | "connecting"
  | "connected"
  | "participant_connected"
  | "participant_disconnected"
  | "track_subscribed"
  | "track_unsubscribed"
  | "disconnected"
  | "local_media_started"
  | "local_media_stopped"
  | "transcript_added"
  | "summary_generated"
  | "room_ended"
  | "error";

export function writeLog(target: HTMLElement, event: RoomLogEvent, data?: unknown): void {
  const line = `[${new Date().toISOString()}] ${event}${data === undefined ? "" : ` ${JSON.stringify(redact(data), null, 2)}`}`;
  target.textContent = `${line}\n${target.textContent ?? ""}`.slice(0, 16000);
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/token|secret|key/i.test(key)) {
      output[key] = entry ? "[redacted]" : entry;
    } else {
      output[key] = redact(entry);
    }
  }
  return output;
}
