import type { SearchProvider, SearchResult } from "../types.js";
import { config } from "../../config.js";
import { ResearchProviderError } from "../types.js";
import { sanitizeSourceText } from "../prompt-injection-guard.js";
import { tavilyTuningForQuery } from "../tavily-tuning.js";

export function tavilySearchProvider(apiKey: string): SearchProvider {
  return {
    name: "tavily",
    async search(params) {
      const tuning = tavilyTuningForQuery({ query: params.query, maxResults: params.maxResults });
      const query = tuning.query;
      if (!query) throw new ResearchProviderError("provider_failed", "Search query is empty");
      const signal = params.signal ? AbortSignal.any([params.signal, AbortSignal.timeout(config.RESEARCH_PROVIDER_TIMEOUT_MS)]) : AbortSignal.timeout(config.RESEARCH_PROVIDER_TIMEOUT_MS);
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          query,
          topic: tuning.topic,
          search_depth: tuning.searchDepth,
          include_answer: tuning.includeAnswer,
          include_raw_content: tuning.includeRawContent,
          max_results: tuning.maxResults,
        }),
        signal,
      });
      if (res.status === 401 || res.status === 403) throw new ResearchProviderError("provider_not_configured", "Tavily credentials were rejected");
      if (res.status === 429) throw new ResearchProviderError("provider_failed", "Tavily rate limit reached");
      if (!res.ok) throw new ResearchProviderError("provider_failed", `Tavily search failed: HTTP ${res.status}`);
      const json = (await res.json()) as { results?: Array<{ title?: string; url?: string; content?: string; raw_content?: string; published_date?: string; score?: number }> };
      let results = (json.results ?? []).filter((item) => item.url).slice(0, params.maxResults).map<SearchResult>((item) => ({
        title: item.title ?? item.url ?? "Untitled",
        url: item.url ?? "",
        snippet: sanitizeSourceText(item.raw_content ?? item.content ?? "", 4000),
        publishedAt: item.published_date ?? null,
        sourceType: "unknown",
        raw: item,
      }));
      if (config.TAVILY_REQUIRE_SOURCE_URLS && results.some((result) => !result.url)) {
        throw new ResearchProviderError("provider_failed", "Tavily returned a result without a source URL");
      }
      if (config.TAVILY_ENABLE_EXTRACT && config.TAVILY_EXTRACT_MAX_URLS > 0) {
        results = await mergeExtractedContent({ apiKey, results, signal });
      }
      return results;
    },
  };
}

async function mergeExtractedContent(args: { apiKey: string; results: SearchResult[]; signal: AbortSignal }): Promise<SearchResult[]> {
  const urls = args.results.slice(0, config.TAVILY_EXTRACT_MAX_URLS).map((result) => result.url).filter(Boolean);
  if (urls.length === 0) return args.results;
  const res = await fetch("https://api.tavily.com/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.apiKey}` },
    body: JSON.stringify({ urls, extract_depth: "basic", format: "text" }),
    signal: args.signal,
  }).catch(() => null);
  if (!res || !res.ok) return args.results;
  const json = (await res.json()) as {
    results?: Array<{ url?: string; raw_content?: string; content?: string }>;
  };
  const extractedByUrl = new Map((json.results ?? []).filter((item) => item.url).map((item) => [item.url, sanitizeSourceText(item.raw_content ?? item.content ?? "", 8000)]));
  return args.results.map((result) => {
    const extracted = extractedByUrl.get(result.url);
    return extracted ? { ...result, snippet: extracted, raw: { search: result.raw, extracted: true } } : result;
  });
}
