import { describe, expect, it } from "vitest";
import { classifySegment } from "../src/trigger/classifier.js";

describe("trigger classifier", () => {
  it("detects bank APR and fee triggers", () => {
    const triggers = classifySegment({ speaker: "speaker_1", text: "The APR is 9.4 percent with an arrangement fee." }, "bank_loan");
    expect(triggers.map((t) => t.type)).toContain("financial_term");
    expect(triggers.map((t) => t.type)).toContain("money_or_percent");
  });

  it("detects doctor medication and test result triggers", () => {
    const triggers = classifySegment({ speaker: "speaker_1", text: "Your blood test results mean we should discuss medication side effects." }, "doctor_visit");
    expect(triggers.map((t) => t.type)).toContain("test_result");
    expect(triggers.map((t) => t.type)).toContain("medication");
  });

  it("detects meeting commitments and decisions", () => {
    const triggers = classifySegment({ speaker: "me", text: "We agreed to move forward and I'll send it tomorrow." }, "business_meeting");
    expect(triggers.map((t) => t.type)).toContain("decision");
    expect(triggers.map((t) => t.type)).toContain("commitment");
    expect(triggers.map((t) => t.type)).toContain("deadline");
  });

  it("detects vague commitment language", () => {
    const triggers = classifySegment({ speaker: "speaker_1", text: "Let's follow up soon." }, "business_meeting");
    expect(triggers.map((t) => t.type)).toContain("vague_commitment");
  });
});
