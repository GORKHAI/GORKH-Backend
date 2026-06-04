import { describe, expect, it } from "vitest";
import { createInviteToken, hashInviteToken } from "../src/rooms/invite.js";
import { canTranscriptAfterConsent, roomConfigStatus, RoomsPolicyError } from "../src/rooms/policy.js";
import { createLiveKitAccessToken, liveKitPermissionsForRole } from "../src/rooms/livekit-client.js";
import { consentAllowsJoin, parseRoomMode } from "../services/voice-gateway/src/room-client/consent-ui.js";

describe("Nearmind Rooms policy", () => {
  it("defaults disabled and does not claim LiveKit is configured", () => {
    const status = roomConfigStatus();
    expect(status.enabled).toBe(false);
    expect(status.provider).toBe("livekit");
    if (!status.configured) expect(status.errorCode).toMatch(/rooms_/);
  });

  it("hashes invite tokens without storing the raw token", () => {
    const token = createInviteToken();
    const hash = hashInviteToken(token);
    expect(token).not.toEqual(hash);
    expect(hash).toHaveLength(64);
    expect(hashInviteToken(token)).toEqual(hash);
  });

  it("requires all human participants to grant consent before transcript ingestion", () => {
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
    await expect(createLiveKitAccessToken({ identity: "host-test", roomName: "room-test", role: "host" })).rejects.toBeInstanceOf(RoomsPolicyError);
  });

  it("keeps host and guest LiveKit grants least-privilege and publish-capable", () => {
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
