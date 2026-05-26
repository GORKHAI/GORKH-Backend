import { z } from "zod";

export type ResearchKind = "quick_lookup" | "source_verification" | "deep_research" | "no_research";
export type ResearchUrgency = "none" | "low" | "medium" | "high";
export type SearchProviderName = "none" | "brave" | "tavily" | "exa";
export type SourceType = "official" | "academic" | "news" | "company" | "forum" | "unknown";

export interface ResearchNeedDecision {
  needsResearch: boolean;
  urgency: ResearchUrgency;
  researchKind: ResearchKind;
  suggestedQuery: string | null;
  reason: string;
  allowedDuringLive: boolean;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string | null;
  sourceType?: SourceType;
  raw?: unknown;
}

export interface SearchProvider {
  readonly name: SearchProviderName;
  search(params: { query: string; maxResults: number; signal?: AbortSignal }): Promise<SearchResult[]>;
}

export class ResearchProviderError extends Error {
  constructor(
    readonly code: "provider_not_configured" | "provider_failed" | "fetch_blocked",
    message: string,
  ) {
    super(message);
    this.name = "ResearchProviderError";
  }
}

export const researchAnswerSchema = z.object({
  answer: z.string(),
  citations: z.array(z.object({ url: z.string().url(), title: z.string().optional(), quote: z.string().optional() })),
  confidence: z.number().min(0).max(1),
  limitations: z.string().nullable().optional(),
});

export type ResearchAnswer = z.infer<typeof researchAnswerSchema>;
