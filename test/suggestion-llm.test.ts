import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import { generateFastCue } from "../src/cue/fast-cues.js";
import { suggest, parseSuggestionCard } from "../src/suggest/engine.js";

describe("suggestion LLM behavior", () => {
  it("deterministic fast cue is unaffected by missing LLM", () => {
    const cue = generateFastCue({
      internalType: "bank_loan",
      text: "The APR is 9.4 percent.",
      triggers: [{ type: "financial_term", reason: "APR mentioned", match: "APR", priority: 3 }],
    });
    expect(cue?.cue.spokenCue).toBe("Ask APR details.");
  });

  it("missing LLM emits provider error", async () => {
    const originalProvider = config.LLM_PROVIDER;
    const originalKey = config.DEEPSEEK_API_KEY;
    config.LLM_PROVIDER = "deepseek";
    config.DEEPSEEK_API_KEY = undefined;
    await expect(suggest({ internalType: "bank_loan", context: [], triggers: [], memory: [] })).rejects.toMatchObject({
      code: "provider_not_configured",
    });
    config.LLM_PROVIDER = originalProvider;
    config.DEEPSEEK_API_KEY = originalKey;
  });

  it("valid JSON parses into bounded SuggestionCard", () => {
    const card = parseSuggestionCard(
      JSON.stringify({
        headline: "Clarify signing",
        detail: "Ask for written terms before signing.",
        spokenCue: "Do not sign until written terms arrive",
        visualCue: "Ask for written terms before signing.",
        kind: "caution",
        urgency: "high",
        confidence: 1.2,
        delivery: "earbud",
      }),
    );
    expect(card.spokenCue.split(/\s+/)).toHaveLength(7);
    expect(card.confidence).toBe(1);
    expect(card.detail.toLowerCase()).not.toMatch(/\bdiagnose|change medication|you should sign\b/);
  });
});
