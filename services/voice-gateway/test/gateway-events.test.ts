import { describe, expect, it } from "vitest";
import { GatewaySession } from "../src/session.js";
import { gatewayClientEventSchema } from "../src/types.js";

describe("gateway event schemas", () => {
  it("parses valid text start events", () => {
    expect(gatewayClientEventSchema.safeParse(start({ input: { kind: "text" } })).success).toBe(true);
  });

  it("parses valid pcm16 start events", () => {
    expect(gatewayClientEventSchema.safeParse(start({ input: { kind: "pcm16", sampleRate: 16000, channels: 1 } })).success).toBe(true);
  });

  it("rejects invalid policy", () => {
    expect(gatewayClientEventSchema.safeParse(start({ policy: "bank_mode" })).success).toBe(false);
  });

  it("rejects invalid input kind", () => {
    expect(gatewayClientEventSchema.safeParse(start({ input: { kind: "wav" } })).success).toBe(false);
  });

  it("rejects invalid consent shape", () => {
    expect(gatewayClientEventSchema.safeParse(start({ consent: { granted: true } })).success).toBe(false);
  });

  it("rejects binary before start in the session manager", async () => {
    const events: Array<{ type: string; [key: string]: unknown }> = [];
    const session = new GatewaySession("user-1", "token", (event) => events.push(event));
    await session.handleBinary(Buffer.alloc(2));
    expect(events).toContainEqual(expect.objectContaining({ type: "gateway_error", stage: "protocol" }));
  });
});

function start(overrides: Record<string, unknown> = {}) {
  return {
    type: "start",
    policy: "conversation_agent",
    situationDescription: "I am going to the bank",
    title: "Bank",
    consent: {
      granted: true,
      method: "user_tap",
      noticeText: "Live Assist is active. I confirm consent.",
      participantCount: 1,
      jurisdiction: "unknown",
    },
    input: { kind: "text" },
    output: { kind: "both" },
    retentionPolicy: "ask_on_stop",
    ...overrides,
  };
}
