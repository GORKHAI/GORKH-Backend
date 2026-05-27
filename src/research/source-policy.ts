import { config } from "../config.js";
import type { SourceType } from "./types.js";

export type ResearchDomain =
  | "bank_loan"
  | "finance"
  | "doctor_visit"
  | "legal_consultation"
  | "company_brief"
  | "general"
  | "news/current"
  | "technical";

export interface ResearchSourcePolicy {
  domain: ResearchDomain;
  allowedSourceTypes: SourceType[];
  preferredSourceTypes: SourceType[];
  requiresFreshness: boolean;
  maxAgeDays: number;
  minCitations: number;
  llmSynthesisAllowed: boolean;
  highStakes: boolean;
  safetyCaveat: string | null;
}

const allSourceTypes: SourceType[] = ["official", "academic", "news", "company", "forum", "unknown"];

export function classifyResearchDomain(input?: { internalType?: string | null; text?: string | null; intent?: string | null }): ResearchDomain {
  const value = `${input?.internalType ?? ""} ${input?.intent ?? ""} ${input?.text ?? ""}`.toLowerCase();
  if (/\b(bank|loan|mortgage|apr|credit|repayment)\b/.test(value)) return "bank_loan";
  if (/\b(finance|market|stock|price|rate|interest|tax)\b/.test(value)) return "finance";
  if (/\b(doctor|medical|medication|blood test|diagnosis|side effect)\b/.test(value)) return "doctor_visit";
  if (/\b(legal|law|contract|lawsuit|regulation|compliance)\b/.test(value)) return "legal_consultation";
  if (/\b(company|competitor|background|brief|organization)\b/.test(value)) return "company_brief";
  if (/\b(today|latest|current|recent|news|this week)\b/.test(value)) return "news/current";
  if (/\b(api|code|technical|documentation|sdk|architecture)\b/.test(value)) return "technical";
  return "general";
}

export function sourcePolicyForDomain(domain: ResearchDomain): ResearchSourcePolicy {
  if (domain === "bank_loan" || domain === "finance") {
    return {
      domain,
      allowedSourceTypes: ["official", "academic", "news", "company"],
      preferredSourceTypes: ["official", "academic"],
      requiresFreshness: domain === "finance",
      maxAgeDays: config.RESEARCH_SOURCE_MAX_AGE_DAYS_DEFAULT,
      minCitations: config.RESEARCH_HIGH_STAKES_MIN_CITATIONS,
      llmSynthesisAllowed: true,
      highStakes: true,
      safetyCaveat: "This is informational only; do not treat it as final financial, tax, or legal advice.",
    };
  }
  if (domain === "doctor_visit") {
    return {
      domain,
      allowedSourceTypes: ["official", "academic"],
      preferredSourceTypes: ["official", "academic"],
      requiresFreshness: false,
      maxAgeDays: config.RESEARCH_SOURCE_MAX_AGE_DAYS_DEFAULT,
      minCitations: config.RESEARCH_HIGH_STAKES_MIN_CITATIONS,
      llmSynthesisAllowed: true,
      highStakes: true,
      safetyCaveat: "This is informational only; ask a qualified clinician for medical advice.",
    };
  }
  if (domain === "legal_consultation") {
    return {
      domain,
      allowedSourceTypes: ["official", "academic", "news", "company"],
      preferredSourceTypes: ["official"],
      requiresFreshness: true,
      maxAgeDays: config.RESEARCH_SOURCE_MAX_AGE_DAYS_DEFAULT,
      minCitations: config.RESEARCH_HIGH_STAKES_MIN_CITATIONS,
      llmSynthesisAllowed: true,
      highStakes: true,
      safetyCaveat: "This is informational only; ask a qualified legal professional for advice.",
    };
  }
  if (domain === "news/current") {
    return {
      domain,
      allowedSourceTypes: ["official", "news", "company"],
      preferredSourceTypes: ["official", "news"],
      requiresFreshness: true,
      maxAgeDays: config.RESEARCH_SOURCE_MAX_AGE_DAYS_NEWS,
      minCitations: config.RESEARCH_MIN_CITATIONS,
      llmSynthesisAllowed: true,
      highStakes: false,
      safetyCaveat: "Recent information can change quickly; verify before acting.",
    };
  }
  if (domain === "technical") {
    return {
      domain,
      allowedSourceTypes: ["official", "academic", "company"],
      preferredSourceTypes: ["official", "company"],
      requiresFreshness: false,
      maxAgeDays: config.RESEARCH_SOURCE_MAX_AGE_DAYS_DEFAULT,
      minCitations: config.RESEARCH_MIN_CITATIONS,
      llmSynthesisAllowed: true,
      highStakes: false,
      safetyCaveat: null,
    };
  }
  return {
    domain,
    allowedSourceTypes: allSourceTypes,
    preferredSourceTypes: ["official", "academic", "company", "news"],
    requiresFreshness: false,
    maxAgeDays: config.RESEARCH_SOURCE_MAX_AGE_DAYS_DEFAULT,
    minCitations: config.RESEARCH_MIN_CITATIONS,
    llmSynthesisAllowed: true,
    highStakes: false,
    safetyCaveat: null,
  };
}

export function isHighStakesDomain(domain: ResearchDomain): boolean {
  return sourcePolicyForDomain(domain).highStakes;
}
