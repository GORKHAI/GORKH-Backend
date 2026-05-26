import type { SearchResult, SourceType } from "./types.js";

export function classifySource(url: string): SourceType {
  const host = safeHost(url);
  if (!host) return "unknown";
  if (/\.(gov|gouv\.fr|europa\.eu)$/.test(host) || host.endsWith(".gov.uk") || host.endsWith("service-public.fr")) return "official";
  if (/\.(edu|ac\.uk)$/.test(host) || host.includes("nih.gov") || host.includes("who.int")) return "academic";
  if (/(reuters|apnews|bbc|lemonde|nytimes|ft\.com|wsj)\./.test(host)) return "news";
  if (/(reddit|x\.com|twitter|facebook|forum)/.test(host)) return "forum";
  return "company";
}

export function scoreSource(result: SearchResult, domain?: string): number {
  const type = result.sourceType ?? classifySource(result.url);
  const base = type === "official" ? 0.9 : type === "academic" ? 0.82 : type === "news" ? 0.68 : type === "company" ? 0.58 : type === "forum" ? 0.25 : 0.35;
  const highStakesBoost = domain && ["doctor_visit", "legal_consultation", "bank_loan"].includes(domain) && (type === "official" || type === "academic") ? 0.08 : 0;
  return Math.min(1, base + highStakesBoost);
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}
