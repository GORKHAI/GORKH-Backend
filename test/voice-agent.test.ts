import { afterEach, describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import type { LlmProvider } from "../src/llm/types.js";
import { answerVoiceUserText } from "../src/voice/agent.js";

describe("voice agent", () => {
  const originalProvider = config.LLM_PROVIDER;
  const originalDeepSeekKey = config.DEEPSEEK_API_KEY;

  afterEach(() => {
    config.LLM_PROVIDER = originalProvider;
    config.DEEPSEEK_API_KEY = originalDeepSeekKey;
  });

  it("returns deterministic bank preparation questions", async () => {
    const result = await answerVoiceUserText({
      text: "What should I ask before this bank meeting?",
      internalType: "bank_loan",
      policy: "conversation_agent",
    });
    expect(result.kind).toBe("assistant_text");
    expect(result.text).toContain("APR");
    expect(result.text).toContain("total repayment");
    expect(result.text).toContain("Do not make final financial decisions");
  });

  it("returns doctor-safe preparation without diagnosis or treatment recommendation", async () => {
    const result = await answerVoiceUserText({
      text: "What should I ask my doctor about blood test results?",
      internalType: "doctor_visit",
      policy: "conversation_agent",
    });
    expect(result.kind).toBe("assistant_text");
    expect(result.text).toContain("What do these results mean");
    expect(result.text?.toLowerCase()).not.toMatch(/\byou should (take|stop|change)|i recommend treatment\b/);
  });

  it("includes legal/financial boundaries when relevant", async () => {
    const result = await answerVoiceUserText({
      text: "brief me before the legal consultation",
      internalType: "legal_consultation",
      policy: "conversation_agent",
    });
    expect(result.text).toContain("Do not make final legal decisions");
  });

  it("returns typed provider error for open-ended request without LLM", async () => {
    config.LLM_PROVIDER = "deepseek";
    config.DEEPSEEK_API_KEY = undefined;
    const result = await answerVoiceUserText({
      text: "Write me a detailed strategy for this conversation",
      internalType: "general",
      policy: "conversation_agent",
    });
    expect(result).toEqual({
      kind: "provider_not_configured",
      message: "DeepSeek (DEEPSEEK_API_KEY) is not configured",
    });
  });

  it("returns injected LLM text for open-ended request", async () => {
    const fakeProvider: LlmProvider = {
      name: "none",
      async completeText() {
        return { text: "Ask for the exact terms in writing before deciding.", provider: "test", model: "test" };
      },
      async completeJson() {
        throw new Error("not used");
      },
    };
    const result = await answerVoiceUserText({
      text: "Explain this situation",
      internalType: "bank_loan",
      policy: "conversation_agent",
      llmProvider: fakeProvider,
    });
    expect(result.kind).toBe("assistant_text");
    expect(result.text).toContain("exact terms");
  });
});
