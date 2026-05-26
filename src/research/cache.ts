const cache = new Map<string, { expiresAt: number; value: unknown }>();

export function getResearchCache<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit || hit.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}

export function setResearchCache(key: string, value: unknown, ttlSeconds: number): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function clearResearchCache(): void {
  cache.clear();
}
