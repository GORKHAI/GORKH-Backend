import { config } from "../config.js";
import { createLiveKitAccessToken, liveKitPermissionsForRole } from "../rooms/livekit-client.js";
import { roomConfigStatus } from "../rooms/policy.js";

const status = roomConfigStatus();

if (!status.enabled || !status.configured) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        status: "rooms_not_configured",
        providerStatus: status,
        message: "LiveKit token check skipped because Rooms/LiveKit are not fully configured. No fake token was generated.",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const roomName = `nearmind-token-check-${Date.now()}`;
const [hostToken, guestToken] = await Promise.all([
  createLiveKitAccessToken({ identity: "token-check-host", displayName: "Token Check Host", roomName, role: "host" }),
  createLiveKitAccessToken({ identity: "token-check-guest", displayName: "Token Check Guest", roomName, role: "guest" }),
]);

const result = {
  ok: true,
  status: "token_shape_valid",
  livekitUrlConfigured: Boolean(config.LIVEKIT_URL),
  host: {
    tokenGenerated: hostToken.length > 32,
    permissions: liveKitPermissionsForRole("host"),
  },
  guest: {
    tokenGenerated: guestToken.length > 32,
    permissions: liveKitPermissionsForRole("guest"),
  },
  secretsExposed: false,
  note: "Token values are intentionally not printed.",
};

if (!hostToken || !guestToken) {
  throw new Error("LiveKit token generation failed");
}

console.log(JSON.stringify(result, null, 2));
