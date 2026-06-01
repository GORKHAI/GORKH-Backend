import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { roomParticipants, roomTranscriptSegments, rooms } from "../db/schema.js";
import { logRoomAuditEvent } from "./audit.js";
import { canTranscriptAfterConsent, RoomsPolicyError } from "./policy.js";
import type { TranscriptSegmentBody } from "./types.js";

export async function addRoomTranscriptSegment(userId: string, roomId: string, input: TranscriptSegmentBody) {
  const [room] = await db.select().from(rooms).where(and(eq(rooms.id, roomId), eq(rooms.userId, userId))).limit(1);
  if (!room) return null;
  if (room.status === "ended" || room.status === "canceled") throw new RoomsPolicyError("room_ended", "Room is ended or canceled.");
  const participants = await db.select().from(roomParticipants).where(eq(roomParticipants.roomId, room.id));
  if (!canTranscriptAfterConsent(room.consentRequired, participants)) throw new RoomsPolicyError("consent_required", "All human participants must grant consent before transcript ingestion.");
  const [segment] = await db
    .insert(roomTranscriptSegments)
    .values({
      roomId: room.id,
      speakerLabel: input.speakerLabel,
      text: input.text,
      offsetMs: input.offsetMs ?? null,
      isFinal: input.isFinal ?? true,
    })
    .returning();
  if (segment) await logRoomAuditEvent({ roomId: room.id, userId, eventType: "transcript_segment_added", payload: { segmentId: segment.id, speakerLabel: input.speakerLabel, isFinal: segment.isFinal } }).catch(() => null);
  return segment ?? null;
}

export async function listRoomTranscript(userId: string, roomId: string) {
  const [room] = await db.select({ id: rooms.id }).from(rooms).where(and(eq(rooms.id, roomId), eq(rooms.userId, userId))).limit(1);
  if (!room) return null;
  return db.select().from(roomTranscriptSegments).where(eq(roomTranscriptSegments.roomId, room.id)).orderBy(asc(roomTranscriptSegments.createdAt));
}
