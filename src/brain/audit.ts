import { db } from "../db/client.js";
import { brainAuditEvents } from "../db/schema.js";

export async function logBrainAuditEvent(args: { userId?: string | null; sessionId?: string | null; eventType: string; payload: unknown }): Promise<string | null> {
  const [row] = await db
    .insert(brainAuditEvents)
    .values({ userId: args.userId ?? null, sessionId: args.sessionId ?? null, eventType: args.eventType, payload: args.payload })
    .returning({ id: brainAuditEvents.id });
  return row?.id ?? null;
}
