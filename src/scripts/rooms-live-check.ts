import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { createGuestLink, createRoom, endRoom } from "../rooms/room-service.js";
import { guestTokenForInvite, hostTokenForRoom } from "../rooms/token-service.js";
import { setGuestConsent } from "../rooms/consent.js";
import { roomConfigStatus } from "../rooms/policy.js";

const status = roomConfigStatus();

if (!status.enabled || !status.configured) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        status: "rooms_not_configured",
        providerStatus: status,
        message: "Rooms live check skipped because LiveKit is not configured. No fake room join was claimed.",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const email = `rooms-live-check-${Date.now()}@gorkh.dev`;
const [user] = await db.insert(users).values({ email, displayName: "Rooms Live Check" }).returning();
if (!user) throw new Error("failed to create rooms live check user");

const room = await createRoom(user.id, {
  title: "Rooms live check",
  transcriptionEnabled: true,
  recordingEnabled: false,
  aiAgentEnabled: false,
});
if (!room) throw new Error("failed to create rooms live check room");

const hostToken = await hostTokenForRoom(user.id, room.id);
if (!hostToken?.token || hostToken.participantRole !== "host") throw new Error("host token shape invalid");

const guestLink = await createGuestLink(user.id, room.id, { displayName: "Rooms Live Guest", email: "rooms-live-guest@gorkh.dev" });
if (!guestLink?.inviteToken || !guestLink.guestLink) throw new Error("guest link creation failed");

await setGuestConsent(guestLink.inviteToken, { consentStatus: "granted", displayName: "Rooms Live Guest", email: "rooms-live-guest@gorkh.dev" });
const guestToken = await guestTokenForInvite(guestLink.inviteToken, "Rooms Live Guest");
if (!guestToken?.token || guestToken.participantRole !== "guest") throw new Error("guest token shape invalid");

await endRoom(user.id, room.id);

console.log(
  JSON.stringify(
    {
      ok: true,
      status: "livekit_tokens_generated",
      roomId: room.id,
      providerRoomName: room.providerRoomName,
      host: {
        tokenGenerated: true,
        permissions: hostToken.permissions,
      },
      guest: {
        tokenGenerated: true,
        permissions: guestToken.permissions,
        guestLinkGenerated: true,
      },
      mediaJoinTested: false,
      note: "Real browser camera/audio join still requires the manual checklist. Tokens are not printed.",
    },
    null,
    2,
  ),
);
