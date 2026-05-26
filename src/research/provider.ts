import { config, requireKey } from "../config.js";
import { braveSearchProvider } from "./search-providers/brave.js";
import { exaSearchProvider } from "./search-providers/exa.js";
import { tavilySearchProvider } from "./search-providers/tavily.js";
import { noneSearchProvider } from "./none.js";
import type { SearchProvider } from "./types.js";

export function createSearchProvider(): SearchProvider {
  if (config.RESEARCH_PROVIDER === "brave") {
    return braveSearchProvider(requireKey(config.BRAVE_API_KEY, "Brave Search (BRAVE_API_KEY)"));
  }
  if (config.RESEARCH_PROVIDER === "tavily") {
    return tavilySearchProvider(requireKey(config.TAVILY_API_KEY, "Tavily (TAVILY_API_KEY)"));
  }
  if (config.RESEARCH_PROVIDER === "exa") {
    return exaSearchProvider(requireKey(config.EXA_API_KEY, "Exa (EXA_API_KEY)"));
  }
  return noneSearchProvider;
}

export function researchProviderStatus() {
  return {
    selected: config.RESEARCH_PROVIDER,
    configured:
      config.RESEARCH_PROVIDER === "none"
        ? false
        : config.RESEARCH_PROVIDER === "brave"
          ? Boolean(config.BRAVE_API_KEY)
          : config.RESEARCH_PROVIDER === "tavily"
            ? Boolean(config.TAVILY_API_KEY)
            : Boolean(config.EXA_API_KEY),
  };
}
