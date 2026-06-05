import { describe, expect, it } from "vitest";
import { detectRelayIntent } from "../src/relay/chat-intent.js";
import { RelayPolicyError, assertNoMassBroadcast, assertNoPrivateDataSharing } from "../src/relay/policy-core.js";
import { relayDraftBodySchema } from "../src/relay/types.js";
import { relayLiveConfigFromEnv, validateRelayLiveConfig } from "../src/scripts/relay-live-verify.js";

describe("NearMind Relay policy", () => {
  it("rejects mass broadcast language", () => {
    expect(() => assertNoMassBroadcast({ goal: "Ask my team agents for blockers before tomorrow." })).toThrow(RelayPolicyError);
    expect(() => assertNoMassBroadcast({ goal: "Ask all investors if they want the deck." })).toThrow(/one specific recipient/i);
  });

  it("prevents automatic private data sharing", () => {
    expect(() => assertNoPrivateDataSharing({ memory: "private fact" })).toThrow(/does not automatically share/i);
    expect(() => assertNoPrivateDataSharing({ calendar: { busy: true } })).toThrow(/does not automatically share/i);
    expect(() => assertNoPrivateDataSharing({ publicBrief: "safe text only" })).not.toThrow();
  });

  it("draft request payloads never accept client userId", () => {
    const parsed = relayDraftBodySchema.parse({
      requestType: "availability_request",
      recipient: { displayName: "Steve" },
      goal: "Ask if next week works.",
      userId: "00000000-0000-0000-0000-000000000001",
    });
    expect("userId" in parsed).toBe(false);
  });

  it("detects relay chat intents without starting external actions", () => {
    const intent = detectRelayIntent("Ask Steve's agent if he is available for an investor call next week.");
    expect(intent).toMatchObject({
      requestType: "meeting_request",
      recipient: { displayName: "Steve" },
    });
    expect(intent?.goal).toContain("available");
  });

  it("marks team requests as future broadcast flow", () => {
    const intent = detectRelayIntent("Ask my team for blockers before tomorrow.");
    expect(intent?.teamOrBroadcast).toBe(true);
    expect(intent?.requestType).toBe("team_update_request");
  });

  it("live verifier reports missing credentials without printing tokens", () => {
    const cfg = relayLiveConfigFromEnv({
      LIVE_API_URL: "https://api.example.test",
      LIVE_TEST_JWT_A: "secret.jwt.a",
    });
    expect(validateRelayLiveConfig(cfg)).toEqual(["LIVE_TEST_JWT_B", "LIVE_RELAY_TEST_EMAIL_B or LIVE_TEST_EMAIL_B"]);
  });

  it("live verifier allows explicit dev-user mode without JWTs", () => {
    const cfg = relayLiveConfigFromEnv({
      LIVE_API_URL: "https://api.example.test",
      LIVE_RELAY_USE_DEV_USERS: "true",
    });
    expect(validateRelayLiveConfig(cfg)).toEqual([]);
  });
});
