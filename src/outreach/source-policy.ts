import type { InvestorSourceType } from "../db/schema.js";

export function investorSourceTypeForUrl(url: string): InvestorSourceType {
  const lower = url.toLowerCase();
  if (/linkedin\.com|twitter\.com|x\.com/.test(lower)) return "social";
  if (/crunchbase\.com|pitchbook\.com|signal\.nfx\.com|openvc\.app|vcwire/.test(lower)) return "database";
  if (/techcrunch\.com|forbes\.com|sifted\.eu|eu-startups\.com|news|article|blog/.test(lower)) return "article";
  if (/\.gov|\.edu/.test(lower)) return "website";
  try {
    const host = new URL(url).hostname;
    return host ? "website" : "unknown";
  } catch {
    return "unknown";
  }
}

export function safeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown-source";
  }
}

export function sourceConfidenceFromType(type: InvestorSourceType, score?: number | null): number {
  const base = type === "website" ? 0.72 : type === "database" ? 0.68 : type === "article" ? 0.58 : type === "social" ? 0.42 : 0.35;
  return Math.max(0.1, Math.min(0.95, score ?? base));
}
