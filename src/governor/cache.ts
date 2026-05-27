const memoryCache = new Map<string, { value: unknown; expiresAt: number }>();

export function getCachedValue<T>(key: string): T | null {
  const item = memoryCache.get(key);
  if (!item || item.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return item.value as T;
}

export function setCachedValue(key: string, value: unknown, ttlSeconds: number): void {
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}
