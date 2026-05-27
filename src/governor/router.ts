import { config } from "../config.js";
import type { GovernorDecision } from "./types.js";

export function routeWork(input: {
  deterministicAvailable?: boolean;
  cachedAvailable?: boolean;
  needsResearch?: boolean;
  highQuality?: boolean;
  budgetAvailable?: boolean;
  operation: "voice_prep" | "whisper_cue" | "open_chat" | "research_synthesis" | "daily_brief" | "action_explanation";
}): GovernorDecision {
  if (!config.GOVERNOR_ENABLED) return { step: "cheap_llm", provider: config.LLM_PROVIDER, model: config.DEEPSEEK_CHAT_MODEL, allowed: true, reason: "governor_disabled" };
  if (input.deterministicAvailable && config.GOVERNOR_PREFER_DETERMINISTIC) return { step: "deterministic", allowed: true, reason: "deterministic_path_available" };
  if (input.cachedAvailable) return { step: "cached", allowed: true, reason: "cache_hit" };
  if (input.budgetAvailable === false) return { step: "human_approval", allowed: false, errorCode: "provider_budget_exceeded", reason: "daily_provider_budget_exceeded" };
  if (input.operation === "whisper_cue") return { step: "deterministic", allowed: true, reason: "whisper_cue_must_not_wait_for_llm" };
  if (input.needsResearch) return { step: "research_subagent", allowed: true, reason: "fresh_sources_required" };
  if (input.highQuality && config.GOVERNOR_MODE === "quality") return { step: "stronger_llm", provider: config.LLM_PROVIDER, model: config.DEEPSEEK_REASONING_MODEL, allowed: true, reason: "quality_mode" };
  return { step: "cheap_llm", provider: config.LLM_PROVIDER, model: config.DEEPSEEK_CHAT_MODEL, allowed: true, reason: "default_low_cost_model" };
}
