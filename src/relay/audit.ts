import { db } from "../db/client.js";
import { agentRelayAuditEvents } from "../db/schema.js";

export async function logRelayAuditEvent(args: {
  userId?: string | null;
  requestId?: string | null;
  eventType: string;
  payload?: Record<string, unknown>;
}) {
  const [row] = await db
    .insert(agentRelayAuditEvents)
    .values({
      userId: args.userId ?? null,
      requestId: args.requestId ?? null,
      eventType: args.eventType,
      payload: args.payload ?? {},
    })
    .returning();
  return row ?? null;
}
