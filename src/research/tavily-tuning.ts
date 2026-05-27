import { config } from "../config.js";
import { classifyResearchDomain, type ResearchDomain } from "./source-policy.js";

export type TavilyTopic = "general" | "news" | "finance";
export type TavilySearchDepth = "basic" | "advanced";

export interface TavilySearchTuning {
  query: string;
  topic: TavilyTopic;
  searchDepth: TavilySearchDepth;
  maxResults: number;
  includeAnswer: boolean;
  includeRawContent: false | "text";
}

export function tavilyTuningForQuery(args: {
  query: string;
  internalType?: string | null;
  maxResults?: number;
}): TavilySearchTuning {
  const query = normalizeTavilyQuery(args.query);
  const domain = classifyResearchDomain({ text: query, internalType: args.internalType });
  return {
    query,
    topic: tavilyTopicForDomain(domain, query),
    searchDepth: tavilyDepthForDomain(domain, query),
    maxResults: Math.min(Math.max(args.maxResults ?? config.TAVILY_MAX_RESULTS, 1), config.TAVILY_MAX_RESULTS, config.RESEARCH_MAX_RESULTS),
    includeAnswer: false,
    includeRawContent: false,
  };
}

export function tavilyTopicForDomain(domain: ResearchDomain, query = ""): TavilyTopic {
  if (domain === "news/current" || /\b(today|latest|breaking|this week|recent news)\b/i.test(query)) return "news";
  if (domain === "finance" && /\b(stock|market|price|earnings|ticker|rates?)\b/i.test(query)) return "finance";
  return config.TAVILY_DEFAULT_TOPIC;
}

export function tavilyDepthForDomain(domain: ResearchDomain, query = ""): TavilySearchDepth {
  if (/\b(verify|source|official|documents required|regulation|policy)\b/i.test(query)) return "advanced";
  if (domain === "legal_consultation" || domain === "doctor_visit") return "advanced";
  return config.TAVILY_DEFAULT_SEARCH_DEPTH;
}

export function normalizeTavilyQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim().slice(0, 500);
}
