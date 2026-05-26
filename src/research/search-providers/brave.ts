import type { SearchProvider, SearchResult } from "../types.js";
import { config } from "../../config.js";
import { ResearchProviderError } from "../types.js";

export function braveSearchProvider(apiKey: string): SearchProvider {
  return {
    name: "brave",
    async search(params) {
      const query = sanitizeQuery(params.query);
      if (!query) throw new ResearchProviderError("provider_failed", "Search query is empty");
      const signal = params.signal ? AbortSignal.any([params.signal, AbortSignal.timeout(config.RESEARCH_PROVIDER_TIMEOUT_MS)]) : AbortSignal.timeout(config.RESEARCH_PROVIDER_TIMEOUT_MS);
      const url = new URL("https://api.search.brave.com/res/v1/web/search");
      url.searchParams.set("q", query);
      url.searchParams.set("count", String(Math.min(Math.max(params.maxResults, 1), config.RESEARCH_MAX_RESULTS)));
      const res = await fetch(url, { headers: { Accept: "application/json", "X-Subscription-Token": apiKey }, signal });
      if (!res.ok) throw new ResearchProviderError("provider_failed", `Brave search failed: HTTP ${res.status}`);
      const json = (await res.json()) as { web?: { results?: Array<{ title?: string; url?: string; description?: string; age?: string }> } };
      return (json.web?.results ?? []).filter((item) => item.url).slice(0, params.maxResults).map<SearchResult>((item) => ({
        title: item.title ?? item.url ?? "Untitled",
        url: item.url ?? "",
        snippet: item.description ?? "",
        publishedAt: item.age ?? null,
        sourceType: "unknown",
        raw: item,
      }));
    },
  };
}

function sanitizeQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim().slice(0, 500);
}
