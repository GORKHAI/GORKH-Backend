import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { investorProfiles, outreachCampaigns, roomParticipants, rooms } from "../db/schema.js";
import { createInviteToken, hashInviteToken, roomGuestUrl } from "./invite.js";
import { createLiveKitRoom, liveKitRoomName } from "./livekit-client.js";
import { logRoomAuditEvent } from "./audit.js";
import type { CreateRoomBody } from "./types.js";

export async function createRoom(userId: string, input: CreateRoomBody) {
  if (input.outreachCampaignId) {
    const [campaign] = await db.select({ id: outreachCampaigns.id }).from(outreachCampaigns).where(and(eq(outreachCampaigns.id, input.outreachCampaignId), eq(outreachCampaigns.userId, userId))).limit(1);
    if (!campaign) return null;
  }
  if (input.investorId) {
    const [investor] = await db.select().from(investorProfiles).where(and(eq(investorProfiles.id, input.investorId), eq(investorProfiles.userId, userId))).limit(1);
    if (!investor) return null;
  }
  const providerRoomName = liveKitRoomName(randomUUID());
  const [room] = await db
    .insert(rooms)
    .values({
      userId,
      outreachCampaignId: input.outreachCampaignId ?? null,
      investorId: input.investorId ?? null,
      title: input.title,
      provider: "livekit",
      providerRoomName,
      status: "draft",
      aiAgentEnabled: Boolean(input.aiAgentEnabled && config.ROOMS_AI_AGENT_ENABLED),
      transcriptionEnabled: input.transcriptionEnabled ?? config.ROOMS_TRANSCRIPTION_ENABLED,
      recordingEnabled: Boolean(input.recordingEnabled && config.ROOMS_RECORDING_ENABLED),
      consentRequired: config.ROOMS_REQUIRE_CONSENT,
    })
    .returning();
  if (!room) throw new Error("failed to create room");
  await db.insert(roomParticipants).values({
    roomId: room.id,
    userId,
    role: "host",
    displayName: "Host",
    consentStatus: "granted",
  });
  if (config.ROOMS_ENABLED && config.LIVEKIT_URL && config.LIVEKIT_API_KEY && config.LIVEKIT_API_SECRET) {
    const created = await createLiveKitRoom(providerRoomName);
    await logRoomAuditEvent({ roomId: room.id, userId, eventType: created.ok ? "livekit_room_created" : "livekit_room_create_failed", payload: created.ok ? { providerRoomName } : { error: created.error } }).catch(() => null);
  }
  await logRoomAuditEvent({ roomId: room.id, userId, eventType: "room_created", payload: { provider: "livekit", aiAgentEnabled: room.aiAgentEnabled, recordingEnabled: room.recordingEnabled } }).catch(() => null);
  return room;
}

export function listRooms(userId: string) {
  return db.select().from(rooms).where(eq(rooms.userId, userId)).orderBy(desc(rooms.createdAt)).limit(100);
}

export async function getOwnedRoom(userId: string, roomId: string) {
  const [room] = await db.select().from(rooms).where(and(eq(rooms.id, roomId), eq(rooms.userId, userId))).limit(1);
  return room ?? null;
}

export async function roomWithParticipants(userId: string, roomId: string) {
  const room = await getOwnedRoom(userId, roomId);
  if (!room) return null;
  const participants = await db.select().from(roomParticipants).where(eq(roomParticipants.roomId, room.id)).orderBy(desc(roomParticipants.createdAt));
  return { room, participants: participants.map(redactParticipant) };
}

export async function createGuestLink(userId: string, roomId: string, guest?: { displayName?: string; email?: string }) {
  const room = await getOwnedRoom(userId, roomId);
  if (!room) return null;
  const inviteToken = createInviteToken();
  const [participant] = await db
    .insert(roomParticipants)
    .values({
      roomId: room.id,
      userId: null,
      role: "guest",
      displayName: guest?.displayName ?? "Investor guest",
      email: guest?.email ?? null,
      inviteTokenHash: hashInviteToken(inviteToken),
      consentStatus: "pending",
    })
    .returning();
  await logRoomAuditEvent({ roomId: room.id, userId, eventType: "guest_link_created", payload: { participantId: participant?.id, ttlSeconds: config.ROOMS_INVITE_TOKEN_TTL_SECONDS } }).catch(() => null);
  return { participant: participant ? redactParticipant(participant) : null, inviteToken, guestLink: roomGuestUrl(config.ROOMS_PUBLIC_BASE_URL, inviteToken) };
}

export async function endRoom(userId: string, roomId: string) {
  const [room] = await db.update(rooms).set({ status: "ended", updatedAt: new Date() }).where(and(eq(rooms.id, roomId), eq(rooms.userId, userId))).returning();
  if (room) await logRoomAuditEvent({ roomId, userId, eventType: "room_ended", payload: {} }).catch(() => null);
  return room ?? null;
}

function redactParticipant(participant: typeof roomParticipants.$inferSelect) {
  return {
    id: participant.id,
    roomId: participant.roomId,
    role: participant.role,
    displayName: participant.displayName,
    email: participant.email,
    joinedAt: participant.joinedAt,
    leftAt: participant.leftAt,
    consentStatus: participant.consentStatus,
    createdAt: participant.createdAt,
    updatedAt: participant.updatedAt,
  };
}
