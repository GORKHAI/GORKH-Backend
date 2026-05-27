import type { SearchResult } from "./types.js";

export function freshnessScore(source: Pick<SearchResult, "publishedAt">, maxAgeDays: number, now = new Date()): number {
  if (!source.publishedAt) return 0.5;
  const published = new Date(source.publishedAt);
  if (Number.isNaN(published.getTime())) return 0.4;
  const ageMs = Math.max(0, now.getTime() - published.getTime());
  const ageDays = ageMs / 86_400_000;
  if (ageDays <= maxAgeDays / 4) return 1;
  if (ageDays <= maxAgeDays) return Math.max(0.35, 1 - ageDays / maxAgeDays);
  return 0.15;
}

export function sourceIsFreshEnough(source: Pick<SearchResult, "publishedAt">, maxAgeDays: number, now = new Date()): boolean {
  if (!source.publishedAt) return false;
  const published = new Date(source.publishedAt);
  if (Number.isNaN(published.getTime())) return false;
  return now.getTime() - published.getTime() <= maxAgeDays * 86_400_000;
}
