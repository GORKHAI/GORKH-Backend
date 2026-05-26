import { describe, expect, it } from "vitest";
import { extractCommitmentsFromText } from "../src/daily/commitment-extractor.js";
import { detectFollowupSuggestion } from "../src/daily/followup-detector.js";
import { buildPrepPackDraftFromContext } from "../src/daily/meeting-pack.js";
import { priorityForCommitment, rankTasks } from "../src/daily/priority-ranker.js";

describe("daily commitment extraction", () => {
  it("extracts explicit commitments as proposed candidates", () => {
    const items = extractCommitmentsFromText({
      text: "I will send the bank documents by Friday. We agreed to follow up next week.",
      sourceType: "transcript",
      now: new Date("2026-05-26T00:00:00.000Z"),
      internalType: "bank_loan",
    });
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0]?.title).toMatch(/send/i);
    expect(items.every((item) => item.confidence > 0 && item.confidence <= 1)).toBe(true);
    expect(items.some((item) => item.sensitivity === "medium")).toBe(true);
  });

  it("avoids generic non-commitment text", () => {
    expect(extractCommitmentsFromText({ text: "That sounds useful, maybe later.", sourceType: "user_text" })).toEqual([]);
  });

  it("marks doctor follow-up as medium sensitivity and not advice", () => {
    const items = extractCommitmentsFromText({
      text: "The doctor said follow up next week about the blood test result.",
      sourceType: "transcript",
      internalType: "doctor_visit",
    });
    expect(items[0]?.sensitivity).toBe("medium");
    expect(JSON.stringify(items)).not.toMatch(/diagnos|treatment recommendation|change medication/i);
  });
});

describe("daily task ranking", () => {
  it("prioritizes urgent due dates", () => {
    const now = new Date("2026-05-26T00:00:00.000Z");
    expect(priorityForCommitment({ dueAt: new Date("2026-05-27T00:00:00.000Z"), confidence: 0.8, sensitivity: "low" }, now)).toBe("urgent");
  });

  it("ranks higher urgency first", () => {
    const now = new Date("2026-05-26T00:00:00.000Z");
    const ranked = rankTasks(
      [
        { title: "later", priority: "low", dueAt: null, suggestedAt: now, status: "proposed" },
        { title: "soon", priority: "normal", dueAt: new Date("2026-05-27T00:00:00.000Z"), suggestedAt: now, status: "proposed" },
      ],
      now,
    );
    expect(ranked[0]?.title).toBe("soon");
  });
});

describe("follow-up and meeting pack", () => {
  it("detects follow-up needs without sending anything", () => {
    const followup = detectFollowupSuggestion("Follow up next week with the client about pricing.");
    expect(followup?.suggestedMessage).toMatch(/confirm the next steps/i);
  });

  it("builds bank prep pack without final financial advice", () => {
    const pack = buildPrepPackDraftFromContext({
      situationDescription: "I am going to the bank to discuss a loan.",
      internalType: "bank_loan",
    });
    expect(pack.suggestedQuestions.join(" ")).toMatch(/APR|repayment|fees/i);
    expect(JSON.stringify(pack)).not.toMatch(/you should take this loan|best loan/i);
  });
});
