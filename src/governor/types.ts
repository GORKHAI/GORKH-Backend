export type GovernorMode = "cheap" | "balanced" | "quality";
export type GovernorStep = "deterministic" | "cached" | "profile_memory" | "cheap_llm" | "research_subagent" | "stronger_llm" | "human_approval";

export interface GovernorDecision {
  step: GovernorStep;
  provider?: string;
  model?: string;
  reason: string;
  allowed: boolean;
  errorCode?: "provider_budget_exceeded";
}
