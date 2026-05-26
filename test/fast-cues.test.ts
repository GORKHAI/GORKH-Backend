import { describe, expect, it } from "vitest";
import { generateFastCue } from "../src/cue/fast-cues.js";
import { classifySegment } from "../src/trigger/classifier.js";

describe("fast cues", () => {
  it("emits short bank APR earbud cue", () => {
    const text = "The APR is 9.4 percent.";
    const cue = generateFastCue({ internalType: "bank_loan", text, triggers: classifySegment({ speaker: "speaker_1", text }, "bank_loan") });
    expect(cue?.cue.spokenCue).toBe("Ask APR details.");
    expect(cue?.cue.delivery).toBe("earbud");
    expect(cue?.cue.spokenCue.split(/\s+/).length).toBeLessThanOrEqual(8);
  });

  it("emits doctor medication cue", () => {
    const text = "Take this medication and watch for side effects.";
    const cue = generateFastCue({ internalType: "doctor_visit", text, triggers: classifySegment({ speaker: "speaker_1", text }, "doctor_visit") });
    expect(cue?.cue.spokenCue).toBe("Ask side effects.");
  });

  it("emits meeting deadline cue to screen", () => {
    const text = "I'll send that to you soon.";
    const cue = generateFastCue({ internalType: "business_meeting", text, triggers: classifySegment({ speaker: "me", text }, "business_meeting") });
    expect(cue?.cue.spokenCue).toBe("Capture owner and deadline.");
    expect(cue?.cue.delivery).toBe("screen");
  });
});
