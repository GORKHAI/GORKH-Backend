import { describe, expect, it } from "vitest";
import { createInviteToken, hashInviteToken } from "../src/rooms/invite.js";
import { canTranscriptAfterConsent, roomConfigStatus, RoomsPolicyError } from "../src/rooms/policy.js";
import { createLiveKitAccessToken } from "../src/rooms/livekit-client.js";

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
});
