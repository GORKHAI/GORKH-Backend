import { config, type AppConfig } from "../config.js";
import { AnthropicLlmProvider } from "./anthropic.js";
import { DeepSeekLlmProvider } from "./deepseek.js";
import { NoneLlmProvider } from "./none.js";
import type { LlmProvider, LlmProviderName } from "./types.js";

export function createLlmProvider(name: LlmProviderName = config.LLM_PROVIDER): LlmProvider {
  if (name === "deepseek") return new DeepSeekLlmProvider();
  if (name === "anthropic") return new AnthropicLlmProvider();
  return new NoneLlmProvider();
}

export function selectedLlmStatus(cfg: AppConfig = config): {
  selected: LlmProviderName;
  configured: boolean;
  model: string;
} {
  if (cfg.LLM_PROVIDER === "deepseek") {
    return { selected: "deepseek", configured: Boolean(cfg.DEEPSEEK_API_KEY), model: cfg.DEEPSEEK_CHAT_MODEL };
  }
  if (cfg.LLM_PROVIDER === "anthropic") {
    return { selected: "anthropic", configured: Boolean(cfg.ANTHROPIC_API_KEY), model: cfg.ANTHROPIC_MODEL };
  }
  return { selected: "none", configured: false, model: "none" };
}
