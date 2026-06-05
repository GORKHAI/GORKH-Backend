import { describe, expect, it, vi } from "vitest";
import { createInviteToken, hashInviteToken } from "../src/rooms/invite.js";
import { consentAllowsJoin, parseRoomMode } from "../services/voice-gateway/src/room-client/consent-ui.js";

describe("Nearmind Rooms policy", () => {
  it("reports LiveKit configuration without leaking secrets", async () => {
    const { roomConfigStatus } = await import("../src/rooms/policy.js");
    const status = roomConfigStatus();
    expect(status.provider).toBe("livekit");
    if (status.enabled) {
      expect(status.configured).toBe(true);
      expect(status.errorCode).toBeUndefined();
    } else {
      expect(status.configured).toBe(false);
      expect(status.errorCode).toMatch(/rooms_/);
    }
  });

  it("hashes invite tokens without storing the raw token", () => {
    const token = createInviteToken();
    const hash = hashInviteToken(token);
    expect(token).not.toEqual(hash);
    expect(hash).toHaveLength(64);
    expect(hashInviteToken(token)).toEqual(hash);
  });

  it("requires all human participants to grant consent before transcript ingestion", async () => {
    const { canTranscriptAfterConsent } = await import("../src/rooms/policy.js");
    expect(canTranscriptAfterConsent(true, [{ role: "host", consentStatus: "granted" }])).toBe(true);
    expect(
      canTranscriptAfterConsent(true, [
        { role: "host", consentStatus: "granted" },
        { role: "guest", consentStatus: "pending" },
      ]),
    ).toBe(false);
    expect(
      canTranscriptAfterConsent(true, [
        { role: "host", consentStatus: "granted" },
        { role: "guest", consentStatus: "granted" },
        { role: "ai_agent", consentStatus: "pending" },
      ]),
    ).toBe(true);
  });

  it("does not mint fake LiveKit tokens when rooms are disabled or not configured", async () => {
    vi.resetModules();
    vi.stubEnv("ROOMS_ENABLED", "false");
    vi.stubEnv("LIVEKIT_URL", "");
    vi.stubEnv("LIVEKIT_API_KEY", "");
    vi.stubEnv("LIVEKIT_API_SECRET", "");
    const [{ createLiveKitAccessToken }, { RoomsPolicyError }] = await Promise.all([
      import("../src/rooms/livekit-client.js"),
      import("../src/rooms/policy.js"),
    ]);
    await expect(createLiveKitAccessToken({ identity: "host-test", roomName: "room-test", role: "host" })).rejects.toBeInstanceOf(RoomsPolicyError);
    vi.unstubAllEnvs();
  });

  it("keeps host and guest LiveKit grants least-privilege and publish-capable", async () => {
    const { liveKitPermissionsForRole } = await import("../src/rooms/livekit-client.js");
    expect(liveKitPermissionsForRole("host")).toEqual({ canPublish: true, canSubscribe: true, canPublishData: true });
    expect(liveKitPermissionsForRole("guest")).toEqual({ canPublish: true, canSubscribe: true, canPublishData: true });
    expect(liveKitPermissionsForRole("ai_agent")).toEqual({ canPublish: false, canSubscribe: true, canPublishData: false });
    expect(liveKitPermissionsForRole("admin")).toEqual({ canPublish: false, canSubscribe: false, canPublishData: false });
  });

  it("parses host and guest room UI paths", () => {
    expect(parseRoomMode("/rooms/ui/room-123")).toEqual({ mode: "host", roomId: "room-123" });
    expect(parseRoomMode("/r/invite-123")).toEqual({ mode: "guest", inviteToken: "invite-123" });
  });

  it("requires explicit browser consent before joining", () => {
    expect(consentAllowsJoin("host", false)).toEqual({ ok: false, reason: "Consent checkbox is required before joining." });
    expect(consentAllowsJoin("host", true)).toEqual({ ok: true });
    expect(consentAllowsJoin("guest", true, "pending")).toEqual({ ok: false, reason: "Guest consent must be granted before joining." });
    expect(consentAllowsJoin("guest", true, "denied")).toEqual({ ok: false, reason: "Guest consent was denied." });
    expect(consentAllowsJoin("guest", true, "granted")).toEqual({ ok: true });
  });
});
