import { normalizeUrl, validateResearchCitations, type CitationQuality } from "./citations.js";
import { classifyResearchDomain } from "./source-policy.js";
import type { ResearchAnswer, SearchResult } from "./types.js";

export interface ResearchReportCitation {
  sourceId: string;
  title: string;
  url: string;
  sourceType: string;
}

export interface ResearchReportPack {
  schemaVersion: "nearmind.research_report_pack.v1";
  queryId: string;
  answerId?: string | null;
  query: string;
  provider: string;
  answer: string;
  sourceSummary: string;
  keyFindings: string[];
  citations: ResearchReportCitation[];
  limitations: string[];
  confidence: number;
  freshness: {
    requiresFreshness: boolean;
    newestSourceAt: string | null;
    oldestSourceAt: string | null;
    freshnessScore: number;
  };
  nextSuggestedAction: string;
  citationQuality: CitationQuality;
  generatedAt: string;
}

export interface StoredResearchSource {
  id: string;
  url: string;
  title: string | null;
  sourceType: string;
  snippet: string | null;
  extractedText?: string | null;
  publishedAt?: Date | null;
  fetchedAt?: Date | null;
  credibilityScore?: number | null;
}

export interface StoredResearchQuery {
  id: string;
  query: string;
  intent: string;
  provider: string;
  requiresFreshness: boolean;
}

export interface StoredResearchAnswer {
  id: string;
  answer: string;
  citations: unknown;
  confidence: number;
  limitations: string | null;
}

export function buildResearchReportPack(args: {
  query: StoredResearchQuery;
  sources: StoredResearchSource[];
  answer?: StoredResearchAnswer | null;
  now?: Date;
}): ResearchReportPack {
  const answer = args.answer ? toResearchAnswer(args.answer) : sourceOnlyAnswer(args.sources);
  const searchResults = args.sources.map(toSearchResult);
  const domain = classifyResearchDomain({ text: args.query.query, intent: args.query.intent });
  const validation = validateResearchCitations({ answer, sources: searchResults, domain });
  if (answer.citations.length > 0 && !validation.ok) {
    throw new Error(validation.errorCode ?? "citation_not_source_backed");
  }
  const sourceByUrl = new Map(args.sources.map((source) => [normalizeUrl(source.url), source]));
  const citations = validation.citations.map((citation) => {
    const source = sourceByUrl.get(normalizeUrl(citation.url));
    if (!source) throw new Error(`citation_not_source_backed:${citation.url}`);
    return {
      sourceId: source.id,
      title: citation.title ?? source.title ?? source.url,
      url: source.url,
      sourceType: source.sourceType,
    };
  });
  const freshnessDates = args.sources
    .map((source) => source.publishedAt ?? source.fetchedAt ?? null)
    .filter((value): value is Date => value instanceof Date);
  const sortedDates = freshnessDates.map((date) => date.getTime()).sort((a, b) => a - b);
  return {
    schemaVersion: "nearmind.research_report_pack.v1",
    queryId: args.query.id,
    answerId: args.answer?.id ?? null,
    query: args.query.query,
    provider: args.query.provider,
    answer: answer.answer,
    sourceSummary: summarizeSources(args.sources),
    keyFindings: keyFindingsFromAnswer(answer.answer),
    citations,
    limitations: answer.limitations ? [answer.limitations] : limitationsFromSources(args.sources),
    confidence: clamp01(answer.confidence),
    freshness: {
      requiresFreshness: args.query.requiresFreshness,
      newestSourceAt: sortedDates.length ? new Date(sortedDates[sortedDates.length - 1]!).toISOString() : null,
      oldestSourceAt: sortedDates.length ? new Date(sortedDates[0]!).toISOString() : null,
      freshnessScore: validation.quality.freshnessScore,
    },
    nextSuggestedAction: nextSuggestedAction(args.query.intent, citations.length),
    citationQuality: validation.quality,
    generatedAt: (args.now ?? new Date()).toISOString(),
  };
}

function toResearchAnswer(row: StoredResearchAnswer): ResearchAnswer {
  const citations = Array.isArray(row.citations)
    ? row.citations
        .filter((item): item is { url: string; title?: string; quote?: string } => Boolean(item && typeof item === "object" && "url" in item))
        .map((item) => ({ url: String(item.url), title: item.title ? String(item.title) : undefined, quote: item.quote ? String(item.quote) : undefined }))
    : [];
  return { answer: row.answer, citations, confidence: row.confidence, limitations: row.limitations };
}

function sourceOnlyAnswer(sources: StoredResearchSource[]): ResearchAnswer {
  return {
    answer: sources.length ? "Source-backed research results are available for review." : "No sources are available for this query.",
    citations: sources.slice(0, 3).map((source) => ({ url: source.url, title: source.title ?? source.url })),
    confidence: sources.length ? 0.35 : 0,
    limitations: sources.length ? "No synthesized answer is available; review sources directly." : "Research provider was not configured or returned no sources.",
  };
}

function toSearchResult(source: StoredResearchSource): SearchResult {
  return {
    title: source.title ?? source.url,
    url: source.url,
    snippet: source.snippet ?? source.extractedText ?? "",
    publishedAt: source.publishedAt?.toISOString() ?? null,
    sourceType: source.sourceType as SearchResult["sourceType"],
  };
}

function summarizeSources(sources: StoredResearchSource[]): string {
  if (sources.length === 0) return "No source-backed citations are available.";
  const byType = new Map<string, number>();
  for (const source of sources) byType.set(source.sourceType, (byType.get(source.sourceType) ?? 0) + 1);
  return `${sources.length} stored source(s): ${[...byType.entries()].map(([type, count]) => `${count} ${type}`).join(", ")}.`;
}

function keyFindingsFromAnswer(answer: string): string[] {
  return answer
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function limitationsFromSources(sources: StoredResearchSource[]): string[] {
  if (sources.length === 0) return ["No source-backed evidence is available."];
  return ["Limited to the stored public sources available for this query."];
}

function nextSuggestedAction(intent: string, citationCount: number): string {
  if (citationCount === 0) return "Configure a research provider or add source-backed evidence before using this answer.";
  if (/verification|deep/i.test(intent)) return "Review the cited source details before making a decision.";
  return "Use the cited sources as screen references and ask for written confirmation when stakes are high.";
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
