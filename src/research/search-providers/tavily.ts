import type { SearchProvider, SearchResult } from "../types.js";
import { config } from "../../config.js";
import { ResearchProviderError } from "../types.js";

export function tavilySearchProvider(apiKey: string): SearchProvider {
  return {
    name: "tavily",
    async search(params) {
      const query = sanitizeQuery(params.query);
      if (!query) throw new ResearchProviderError("provider_failed", "Search query is empty");
      const signal = params.signal ? AbortSignal.any([params.signal, AbortSignal.timeout(config.RESEARCH_PROVIDER_TIMEOUT_MS)]) : AbortSignal.timeout(config.RESEARCH_PROVIDER_TIMEOUT_MS);
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          query,
          topic: "general",
          search_depth: "basic",
          include_answer: false,
          include_raw_content: false,
          max_results: Math.min(Math.max(params.maxResults, 1), config.RESEARCH_MAX_RESULTS),
        }),
        signal,
      });
      if (!res.ok) throw new ResearchProviderError("provider_failed", `Tavily search failed: HTTP ${res.status}`);
      const json = (await res.json()) as { results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }> };
      return (json.results ?? []).filter((item) => item.url).slice(0, params.maxResults).map<SearchResult>((item) => ({
        title: item.title ?? item.url ?? "Untitled",
        url: item.url ?? "",
        snippet: item.content ?? "",
        publishedAt: item.published_date ?? null,
        sourceType: "unknown",
        raw: item,
      }));
    },
  };
}

function sanitizeQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim().slice(0, 500);
}
