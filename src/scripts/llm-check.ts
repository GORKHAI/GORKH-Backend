import { z } from "zod";
import { config } from "../config.js";
import { createLlmProvider, selectedLlmStatus } from "../llm/provider.js";
import { LlmProviderError } from "../llm/types.js";

async function main(): Promise<void> {
  const status = selectedLlmStatus();
  console.log(`llm: selected=${status.selected} configured=${status.configured} model=${status.model}`);
  if (!status.configured) {
    console.log("llm: provider_not_configured; deterministic paths still available");
    return;
  }
  if (config.LLM_PROVIDER !== "deepseek") {
    console.log("llm: smoke JSON call is currently scoped to DeepSeek");
    return;
  }
  const result = await createLlmProvider("deepseek").completeJson({
    system: "Return strict json only.",
    messages: [{ role: "user", content: "Return only this JSON: {\"ok\":true}" }],
    schemaName: "Ok",
    exampleJson: { ok: true },
    zodSchema: z.object({ ok: z.literal(true) }),
    maxTokens: 40,
    temperature: 0,
  });
  console.log(`llm: deepseek json check ok provider=${result.provider} model=${result.model}`);
}

main().catch((err) => {
  if (err instanceof LlmProviderError && err.code === "provider_not_configured") {
    console.log(`llm: ${err.code}: ${err.message}`);
    process.exit(0);
  }
  console.error(`llm:check failed: ${(err as Error).message}`);
  process.exit(1);
});
