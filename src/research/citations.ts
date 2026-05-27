import { config } from "../config.js";
import { sourceIsFreshEnough, freshnessScore } from "./freshness.js";
import { classifySource, scoreSource } from "./verifier.js";
import { sourcePolicyForDomain, type ResearchDomain } from "./source-policy.js";
import type { ResearchAnswer, SearchResult } from "./types.js";

export interface CitationQuality {
  sourceBacked: boolean;
  citationCount: number;
  officialSourceCount: number;
  highCredibilityCount: number;
  freshnessScore: number;
  unsupportedClaimCount: number;
  overallCitationScore: number;
  findings: string[];
}

export interface CitationValidationResult {
  ok: boolean;
  citations: ResearchAnswer["citations"];
  quality: CitationQuality;
  errorCode?: string;
}

export function validateResearchCitations(args: {
  answer: ResearchAnswer;
  sources: SearchResult[];
  domain: ResearchDomain;
}): CitationValidationResult {
  const policy = sourcePolicyForDomain(args.domain);
  const sourcesByUrl = new Map(args.sources.map((source) => [normalizeUrl(source.url), { ...source, sourceType: source.sourceType ?? classifySource(source.url) }]));
  const findings: string[] = [];
  const citations = args.answer.citations.filter((citation) => {
    const normalized = normalizeUrl(citation.url);
    const source = sourcesByUrl.get(normalized);
    if (!citation.url || !citation.title) findings.push("citation_missing_title_or_url");
    if (!source) findings.push(`citation_not_source_backed:${citation.url}`);
    if (source && isBlockedCitationUrl(source.url)) findings.push(`citation_blocked_url:${source.url}`);
    return Boolean(source && citation.url && citation.title && !isBlockedCitationUrl(source.url));
  });
  const citedSources = citations.map((citation) => sourcesByUrl.get(normalizeUrl(citation.url))).filter(Boolean) as SearchResult[];
  const officialSourceCount = citedSources.filter((source) => (source.sourceType ?? classifySource(source.url)) === "official").length;
  const highCredibilityCount = citedSources.filter((source) => scoreSource(source, args.domain) >= 0.75).length;
  const freshnessScores = citedSources.map((source) => freshnessScore(source, policy.maxAgeDays));
  const avgFreshness = freshnessScores.length ? average(freshnessScores) : 0;
  const unsupportedClaimCount = Math.max(0, args.answer.citations.length - citations.length);
  if (policy.highStakes && !args.answer.limitations) findings.push("high_stakes_answer_missing_limitation");
  if (policy.requiresFreshness && citedSources.some((source) => !sourceIsFreshEnough(source, policy.maxAgeDays))) findings.push("freshness_requirement_not_met");
  if (citations.length < policy.minCitations) findings.push("citation_count_below_domain_minimum");
  const citationRatio = Math.min(1, citations.length / Math.max(1, policy.minCitations));
  const credibilityRatio = Math.min(1, (officialSourceCount + highCredibilityCount) / Math.max(1, citations.length));
  const overallCitationScore = clamp01(citationRatio * 0.45 + credibilityRatio * 0.35 + avgFreshness * 0.2 - unsupportedClaimCount * 0.15);
  const sourceBacked = unsupportedClaimCount === 0 && citations.length >= Math.max(config.RESEARCH_MIN_CITATIONS, policy.minCitations);
  return {
    ok: findings.length === 0 && sourceBacked,
    citations,
    quality: {
      sourceBacked,
      citationCount: citations.length,
      officialSourceCount,
      highCredibilityCount,
      freshnessScore: avgFreshness,
      unsupportedClaimCount,
      overallCitationScore,
      findings,
    },
    errorCode: findings[0],
  };
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}

function isBlockedCitationUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return true;
    return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(parsed.hostname);
  } catch {
    return true;
  }
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
