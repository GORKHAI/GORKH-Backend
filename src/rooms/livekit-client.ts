import { SignJWT } from "jose";
import { config } from "../config.js";
import { assertLiveKitReady } from "./policy.js";
import type { LiveKitRole } from "./types.js";

export function liveKitRoomName(roomId: string): string {
  return `nearmind-${roomId}`;
}

export async function createLiveKitAccessToken(input: { identity: string; displayName?: string | null; roomName: string; role: LiveKitRole }): Promise<string> {
  assertLiveKitReady();
  const now = Math.floor(Date.now() / 1000);
  const grants = grantsForRole(input.role, input.roomName);
  return new SignJWT({
    name: input.displayName ?? input.identity,
    video: grants,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(config.LIVEKIT_API_KEY!)
    .setSubject(input.identity)
    .setNotBefore(now - 10)
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60)
    .sign(new TextEncoder().encode(config.LIVEKIT_API_SECRET!));
}

export async function createLiveKitRoom(roomName: string): Promise<{ ok: true } | { ok: false; error: string }> {
  assertLiveKitReady();
  const adminToken = await createLiveKitAccessToken({ identity: "nearmind-room-admin", roomName, role: "admin" });
  const endpoint = `${config.LIVEKIT_URL!.replace(/\/$/, "")}/twirp/livekit.RoomService/CreateRoom`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: roomName, emptyTimeout: 600, maxParticipants: 12 }),
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok || response.status === 409) return { ok: true };
    return { ok: false, error: `livekit_create_failed_${response.status}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function grantsForRole(role: LiveKitRole, roomName: string): Record<string, unknown> {
  if (role === "admin") {
    return { roomCreate: true, roomAdmin: true, room: roomName };
  }
  if (role === "ai_agent") {
    return {
      roomJoin: true,
      room: roomName,
      canPublish: false,
      canSubscribe: true,
      canPublishData: false,
    };
  }
  return {
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  };
}
