import type { LlmUsage } from "../llm/types.js";

export interface ProviderUsageNormalized {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  estimatedCostUsd: null;
}

export function normalizeProviderUsage(usage?: LlmUsage): ProviderUsageNormalized {
  return {
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
    cachedInputTokens: usage?.cachedInputTokens,
    estimatedCostUsd: null,
  };
}
