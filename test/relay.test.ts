import { describe, expect, it } from "vitest";
import { detectRelayIntent } from "../src/relay/chat-intent.js";
import { RelayPolicyError, assertNoMassBroadcast, assertNoPrivateDataSharing } from "../src/relay/policy-core.js";
import { relayDraftBodySchema } from "../src/relay/types.js";
import { emptyRelayLiveSummary, redactRelayLiveOutput, relayLiveConfigFromEnv, validateRelayLiveConfig } from "../src/scripts/relay-live-verify.js";

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
      LIVE_GATEWAY_URL: "https://voice.example.test",
      LIVE_TEST_JWT_A: "secret.jwt.a",
    });
    expect(validateRelayLiveConfig(cfg)).toEqual(["LIVE_TEST_JWT_B", "OPS_CONSOLE_ADMIN_TOKEN"]);
  });

  it("live verifier allows explicit dev-user mode without JWTs", () => {
    const cfg = relayLiveConfigFromEnv({
      LIVE_API_URL: "https://api.example.test",
      LIVE_GATEWAY_URL: "https://voice.example.test",
      LIVE_RELAY_USE_DEV_USERS: "true",
    });
    expect(validateRelayLiveConfig(cfg)).toEqual([]);
  });

  it("live verifier requires API and gateway URLs", () => {
    const cfg = relayLiveConfigFromEnv({
      LIVE_TEST_JWT_A: "secret.jwt.a",
      LIVE_TEST_JWT_B: "secret.jwt.b",
      LIVE_RELAY_TEST_EMAIL_B: "receiver@example.test",
    });
    expect(validateRelayLiveConfig(cfg)).toContain("LIVE_API_URL");
    expect(validateRelayLiveConfig(cfg)).toContain("LIVE_GATEWAY_URL");
  });

  it("live verifier accepts ops test-user credentials without JWTs", () => {
    const cfg = relayLiveConfigFromEnv({
      LIVE_API_URL: "https://api.example.test",
      LIVE_GATEWAY_URL: "https://voice.example.test",
      OPS_CONSOLE_ADMIN_TOKEN: "ops-secret-token-value",
    });
    expect(validateRelayLiveConfig(cfg)).toEqual([]);
    expect(cfg.emailA).toContain("relay-live-a-");
    expect(cfg.emailB).toContain("relay-live-b-");
  });

  it("live verifier redacts JWT-like values in output", () => {
    const redacted = redactRelayLiveOutput("Bearer eyJabc.def.ghi token=eyJaaa.bbb.ccc OPS_CONSOLE_ADMIN_TOKEN=secret");
    expect(redacted).toContain("Bearer [redacted]");
    expect(redacted).toContain("token=[redacted]");
    expect(redacted).toContain("OPS_CONSOLE_ADMIN_TOKEN=[redacted]");
    expect(redacted).not.toContain("eyJabc.def.ghi");
  });

  it("live verifier summary starts with safe false defaults", () => {
    expect(emptyRelayLiveSummary()).toMatchObject({
      apiLive: false,
      gatewayLive: false,
      externalSendExecuted: false,
      privacyLeakDetected: false,
      rawTokenPrinted: false,
      status: "pending",
    });
  });
});
