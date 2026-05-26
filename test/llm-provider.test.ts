import { describe, expect, it } from "vitest";
import { z } from "zod";
import { config } from "../src/config.js";
import { DeepSeekLlmProvider } from "../src/llm/deepseek.js";
import { parseJsonObject } from "../src/llm/json.js";
import { NoneLlmProvider } from "../src/llm/none.js";
import { createLlmProvider, selectedLlmStatus } from "../src/llm/provider.js";
import { LlmProviderError } from "../src/llm/types.js";

describe("LLM providers", () => {
  it("none provider throws provider_not_configured", async () => {
    await expect(
      new NoneLlmProvider().completeText({ system: "x", messages: [{ role: "user", content: "x" }] }),
    ).rejects.toMatchObject({ code: "provider_not_configured" });
  });

  it("DeepSeek refuses call if key is missing", async () => {
    const original = config.DEEPSEEK_API_KEY;
    config.DEEPSEEK_API_KEY = undefined;
    await expect(
      new DeepSeekLlmProvider().completeText({ system: "x", messages: [{ role: "user", content: "x" }] }),
    ).rejects.toMatchObject({ code: "provider_not_configured" });
    config.DEEPSEEK_API_KEY = original;
  });

  it("parses and validates JSON with zod", () => {
    const schema = z.object({ ok: z.literal(true) });
    expect(schema.parse(parseJsonObject("```json\n{\"ok\":true}\n```", "deepseek"))).toEqual({ ok: true });
  });

  it("invalid JSON throws llm_json_parse_error without fallback", () => {
    expect(() => parseJsonObject("not json", "deepseek")).toThrow(LlmProviderError);
    try {
      parseJsonObject("not json", "deepseek");
    } catch (err) {
      expect((err as LlmProviderError).code).toBe("llm_json_parse_error");
    }
  });

  it("provider factory selects configured providers", () => {
    expect(createLlmProvider("none").name).toBe("none");
    expect(createLlmProvider("deepseek").name).toBe("deepseek");
    expect(createLlmProvider("anthropic").name).toBe("anthropic");
    expect(selectedLlmStatus({ ...config, LLM_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "x" }).configured).toBe(true);
  });
});
