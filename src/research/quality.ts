import { classifySource, scoreSource } from "./verifier.js";
import { sourcePolicyForDomain, type ResearchDomain } from "./source-policy.js";
import type { SearchResult } from "./types.js";

export interface SourceQualitySummary {
  totalSources: number;
  allowedSources: number;
  preferredSources: number;
  averageCredibility: number;
  warnings: string[];
}

export function scoreResearchSources(sources: SearchResult[], domain: ResearchDomain): SourceQualitySummary {
  const policy = sourcePolicyForDomain(domain);
  const enriched = sources.map((source) => ({ ...source, sourceType: source.sourceType ?? classifySource(source.url) }));
  const allowedSources = enriched.filter((source) => policy.allowedSourceTypes.includes(source.sourceType ?? "unknown")).length;
  const preferredSources = enriched.filter((source) => policy.preferredSourceTypes.includes(source.sourceType ?? "unknown")).length;
  const scores = enriched.map((source) => scoreSource(source, domain));
  const warnings: string[] = [];
  if (allowedSources < enriched.length) warnings.push("some_sources_outside_domain_policy");
  if (preferredSources === 0 && policy.highStakes) warnings.push("no_preferred_high_stakes_sources");
  return {
    totalSources: sources.length,
    allowedSources,
    preferredSources,
    averageCredibility: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0,
    warnings,
  };
}
