import { and, eq } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { roomParticipants, rooms } from "../db/schema.js";
import { createLiveKitAccessToken, liveKitPermissionsForRole } from "./livekit-client.js";
import { hashInviteToken } from "./invite.js";
import { RoomsPolicyError } from "./policy.js";
import { logRoomAuditEvent } from "./audit.js";
import type { LiveKitRole } from "./types.js";

const liveKitTokenTtlMs = 60 * 60 * 1000;

export async function hostTokenForRoom(userId: string, roomId: string) {
  const [room] = await db.select().from(rooms).where(and(eq(rooms.userId, userId), eq(rooms.id, roomId))).limit(1);
  if (!room) return null;
  const role = "host";
  const token = await createLiveKitAccessToken({ identity: `host-${userId}`, displayName: "Host", roomName: room.providerRoomName ?? room.id, role });
  await logRoomAuditEvent({ roomId, userId, eventType: "host_token_issued", payload: { role: "host" } }).catch(() => null);
  return liveKitTokenResponse({ token, room, role });
}

export async function guestTokenForInvite(inviteToken: string, displayName?: string) {
  const inviteTokenHash = hashInviteToken(inviteToken);
  const [participant] = await db.select().from(roomParticipants).where(eq(roomParticipants.inviteTokenHash, inviteTokenHash)).limit(1);
  if (!participant || participant.role !== "guest") return null;
  const [room] = await db.select().from(rooms).where(eq(rooms.id, participant.roomId)).limit(1);
  if (!room) return null;
  if (participant.consentStatus === "denied") throw new RoomsPolicyError("consent_denied", "Guest consent was denied for this room.");
  if (participant.consentStatus !== "granted") throw new RoomsPolicyError("consent_required", "Guest consent is required before joining with transcription enabled.");
  const role = "guest";
  const token = await createLiveKitAccessToken({ identity: `guest-${participant.id}`, displayName: displayName ?? participant.displayName ?? "Guest", roomName: room.providerRoomName ?? room.id, role });
  await db.update(roomParticipants).set({ joinedAt: participant.joinedAt ?? new Date(), updatedAt: new Date() }).where(eq(roomParticipants.id, participant.id));
  await logRoomAuditEvent({ roomId: room.id, userId: null, eventType: "guest_token_issued", payload: { participantId: participant.id, role: "guest" } }).catch(() => null);
  return { ...liveKitTokenResponse({ token, room, role }), room: publicRoom(room), participant: publicParticipant(participant) };
}

export function publicRoom(room: typeof rooms.$inferSelect) {
  return {
    id: room.id,
    title: room.title,
    provider: room.provider,
    status: room.status,
    aiAgentEnabled: room.aiAgentEnabled,
    transcriptionEnabled: room.transcriptionEnabled,
    recordingEnabled: room.recordingEnabled,
    consentRequired: room.consentRequired,
  };
}

export function publicParticipant(participant: typeof roomParticipants.$inferSelect) {
  return {
    id: participant.id,
    role: participant.role,
    displayName: participant.displayName,
    consentStatus: participant.consentStatus,
  };
}

export function liveKitTokenResponse(input: { token: string; room: typeof rooms.$inferSelect; role: Exclude<LiveKitRole, "admin"> }) {
  return {
    token: input.token,
    livekitUrl: input.room.provider === "livekit" ? config.LIVEKIT_URL ?? null : null,
    roomId: input.room.id,
    providerRoomName: input.room.providerRoomName,
    participantRole: input.role,
    expiresAt: new Date(Date.now() + liveKitTokenTtlMs).toISOString(),
    permissions: liveKitPermissionsForRole(input.role),
  };
}
