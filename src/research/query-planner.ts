import { detectResearchNeed } from "./need-detector.js";
import { classifyResearchDomain, sourcePolicyForDomain, type ResearchDomain } from "./source-policy.js";

export interface ResearchQueryPlan {
  originalText: string;
  normalizedQuery: string;
  domain: ResearchDomain;
  needsResearch: boolean;
  requiresFreshness: boolean;
  researchKind: string;
  urgency: string;
  maxResults: number;
  minCitations: number;
  highStakes: boolean;
  safetyCaveat: string | null;
}

export function planResearchQuery(input: {
  text: string;
  internalType?: string | null;
  intent?: string | null;
  maxResults: number;
}): ResearchQueryPlan {
  const domain = classifyResearchDomain(input);
  const policy = sourcePolicyForDomain(domain);
  const decision = detectResearchNeed({ text: input.text, internalType: input.internalType ?? undefined });
  const normalizedQuery = (decision.suggestedQuery ?? input.text).replace(/\s+/g, " ").trim();
  return {
    originalText: input.text,
    normalizedQuery,
    domain,
    needsResearch: decision.needsResearch,
    requiresFreshness: decision.urgency !== "none" || policy.requiresFreshness,
    researchKind: decision.researchKind,
    urgency: decision.urgency,
    maxResults: Math.max(1, input.maxResults),
    minCitations: policy.minCitations,
    highStakes: policy.highStakes,
    safetyCaveat: policy.safetyCaveat,
  };
}
