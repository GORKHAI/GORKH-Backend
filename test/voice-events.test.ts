import { describe, expect, it } from "vitest";
import { voiceClientEventSchema, voiceStartSchema } from "../src/voice/types.js";

const validStart = {
  type: "start",
  policy: "conversation_agent",
  situationDescription: "I am going to the bank to discuss a loan",
  title: "Bank prep",
  consent: {
    granted: true,
    method: "user_tap",
    noticeText: "Live Assist is active.",
    participantCount: 1,
    jurisdiction: "unknown",
  },
  input: { kind: "text" },
  output: { kind: "text" },
  retentionPolicy: "ask_on_stop",
};

describe("voice event schemas", () => {
  it("parses valid start, user_text, transcript, and stop events", () => {
    expect(voiceClientEventSchema.parse(validStart).type).toBe("start");
    expect(voiceClientEventSchema.parse({ type: "user_text", text: "What should I ask?" }).type).toBe("user_text");
    expect(voiceClientEventSchema.parse({ type: "transcript", speaker: "speaker_1", text: "APR is 9 percent", offsetMs: 1 }).type).toBe("transcript");
    expect(voiceClientEventSchema.parse({ type: "stop", save: false }).type).toBe("stop");
  });

  it("rejects invalid policy", () => {
    expect(() => voiceStartSchema.parse({ ...validStart, policy: "nvidia_mode" })).toThrow();
  });

  it("rejects invalid output kind", () => {
    expect(() => voiceStartSchema.parse({ ...validStart, output: { kind: "audio" } })).toThrow();
  });

  it("allows consent false at schema level for business logic rejection", () => {
    const parsed = voiceStartSchema.parse({ ...validStart, consent: { ...validStart.consent, granted: false } });
    expect(parsed.consent.granted).toBe(false);
  });
});
