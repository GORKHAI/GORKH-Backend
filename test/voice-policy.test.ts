import { describe, expect, it } from "vitest";
import { enforceCueForPolicy, prepareAssistantTextForPolicy, decideDelivery } from "../src/voice/policy.js";
import { VoiceStateMachine } from "../src/voice/state.js";
import type { Cue } from "../src/cue/fast-cues.js";

const cue: Cue = {
  spokenCue: "Ask for the full total repayment amount before signing anything today",
  visualCue: "Ask for the full repayment schedule and total cost.",
  kind: "ask",
  urgency: "high",
  confidence: 0.9,
  delivery: "earbud",
};

describe("voice policy", () => {
  it("whisper_copilot enforces spokenCue word limit", () => {
    const enforced = enforceCueForPolicy(cue, "whisper_copilot");
    expect(enforced.spokenCue.split(/\s+/).length).toBeLessThanOrEqual(8);
  });

  it("conversation_agent allows longer assistant text", () => {
    const long = "This is a longer answer that should remain available for normal conversation before the meeting.";
    expect(prepareAssistantTextForPolicy(long, "conversation_agent")).toContain("longer answer");
  });

  it("low-priority cues are not forced to earbud", () => {
    expect(decideDelivery({ urgency: "low", delivery: "earbud" }, "whisper_copilot")).toBe("screen");
  });

  it("high-priority cues can be delivered as earbud", () => {
    expect(decideDelivery({ urgency: "high", delivery: "earbud" }, "whisper_copilot")).toBe("earbud");
  });

  it("barge-in state transition cancels active speech", () => {
    const state = new VoiceStateMachine("listening");
    state.startSpeech("speech-1");
    expect(state.cancelSpeech()).toBe("speech-1");
    expect(state.state).toBe("listening");
  });
});
