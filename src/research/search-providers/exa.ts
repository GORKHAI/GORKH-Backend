import type { SearchProvider, SearchResult } from "../types.js";
import { config } from "../../config.js";
import { ResearchProviderError } from "../types.js";

export function exaSearchProvider(apiKey: string): SearchProvider {
  return {
    name: "exa",
    async search(params) {
      const query = sanitizeQuery(params.query);
      if (!query) throw new ResearchProviderError("provider_failed", "Search query is empty");
      const signal = params.signal ? AbortSignal.any([params.signal, AbortSignal.timeout(config.RESEARCH_PROVIDER_TIMEOUT_MS)]) : AbortSignal.timeout(config.RESEARCH_PROVIDER_TIMEOUT_MS);
      const res = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({
          query,
          numResults: Math.min(Math.max(params.maxResults, 1), config.RESEARCH_MAX_RESULTS),
          contents: {
            text: { maxCharacters: 1200 },
            highlights: { numSentences: 2, highlightsPerUrl: 1 },
          },
        }),
        signal,
      });
      if (!res.ok) throw new ResearchProviderError("provider_failed", `Exa search failed: HTTP ${res.status}`);
      const json = (await res.json()) as { results?: Array<{ title?: string; url?: string; text?: string; highlights?: string[]; publishedDate?: string }> };
      return (json.results ?? []).filter((item) => item.url).slice(0, params.maxResults).map<SearchResult>((item) => ({
        title: item.title ?? item.url ?? "Untitled",
        url: item.url ?? "",
        snippet: item.highlights?.[0] ?? item.text ?? "",
        publishedAt: item.publishedDate ?? null,
        sourceType: "unknown",
        raw: item,
      }));
    },
  };
}

function sanitizeQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim().slice(0, 500);
}
