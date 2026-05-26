import { describe, expect, it } from "vitest";
import { parseSuggestionCard } from "../src/suggest/engine.js";

describe("suggestion parser", () => {
  it("parses fenced JSON and clamps confidence", () => {
    const card = parseSuggestionCard(`
      \`\`\`json
      {"headline":"Ask for total cost","detail":"Ask for the full repayment amount.","spokenCue":"Ask for the total repayment amount now please","visualCue":"Ask for the full repayment amount.","kind":"ask","urgency":"high","confidence":2,"delivery":"earbud"}
      \`\`\`
    `);
    expect(card.confidence).toBe(1);
    expect(card.spokenCue.split(/\s+/).length).toBeLessThanOrEqual(8);
    expect(card.delivery).toBe("earbud");
  });

  it("defaults optional fields safely", () => {
    const card = parseSuggestionCard(`{"headline":"Confirm next step"}`);
    expect(card.kind).toBe("note");
    expect(card.urgency).toBe("medium");
    expect(card.visualCue).toBe("Confirm next step");
  });

  it("throws a clear parse error when JSON is impossible", () => {
    expect(() => parseSuggestionCard("not json")).toThrow(/no JSON object found/);
  });
});
