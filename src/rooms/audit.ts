import { db } from "../db/client.js";
import { roomAuditEvents } from "../db/schema.js";

export async function logRoomAuditEvent(input: { roomId: string; userId?: string | null; eventType: string; payload: Record<string, unknown> }): Promise<void> {
  await db.insert(roomAuditEvents).values({
    roomId: input.roomId,
    userId: input.userId ?? null,
    eventType: input.eventType,
    payload: input.payload,
  });
}
