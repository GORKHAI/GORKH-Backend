import { createClient, type RedisClientType } from "redis";
import { config, requireKey } from "./config.js";

export interface BufferedSegment {
  speaker: string;
  text: string;
  offsetMs: number;
  confidence?: number | null;
  createdAt?: string;
}

interface RedisAdapter {
  mode: "socket" | "upstash_rest";
  ping(): Promise<string>;
  rPush(key: string, value: string): Promise<void>;
  lTrim(key: string, start: number, stop: number): Promise<void>;
  expire(key: string, seconds: number): Promise<void>;
  lRange(key: string, start: number, stop: number): Promise<string[]>;
  keys(pattern: string): Promise<string[]>;
  del(keys: string[]): Promise<void>;
  setCooldown(key: string, ms: number): Promise<boolean>;
  flushDb(): Promise<void>;
  close(): Promise<void>;
}

let adapter: RedisAdapter | null = null;

export async function getRedis(): Promise<RedisAdapter> {
  if (!adapter) adapter = createRedisAdapter();
  await adapter.ping();
  return adapter;
}

export async function checkRedis(): Promise<boolean> {
  try {
    const r = await getRedis();
    return (await r.ping()) === "PONG";
  } catch {
    return false;
  }
}

export function redisConnectionMode(): "socket" | "upstash_rest" {
  return shouldUseUpstashRest() ? "upstash_rest" : "socket";
}

export async function pushSegment(sessionId: string, segment: BufferedSegment): Promise<void> {
  const r = await getRedis();
  const key = contextKey(sessionId);
  const enriched = { ...segment, createdAt: segment.createdAt ?? new Date().toISOString() };
  await r.rPush(key, JSON.stringify(enriched));
  await r.lTrim(key, -config.CONTEXT_WINDOW_SEGMENTS, -1);
  await r.expire(key, 60 * 60 * 6);
}

export async function readContext(sessionId: string): Promise<BufferedSegment[]> {
  const r = await getRedis();
  const values = await r.lRange(contextKey(sessionId), 0, -1);
  return values.map((v) => JSON.parse(v) as BufferedSegment);
}

export async function clearSession(sessionId: string): Promise<void> {
  const r = await getRedis();
  const keys = await r.keys(`session:${sessionId}:*`);
  await r.del(keys);
}

export async function closeRedis(): Promise<void> {
  await adapter?.close();
  adapter = null;
}

export async function clearAllRedisForTest(): Promise<void> {
  const r = await getRedis();
  await r.flushDb();
}

export async function tryAcquireSuggestionSlot(sessionId: string): Promise<boolean> {
  const r = await getRedis();
  return r.setCooldown(`session:${sessionId}:cooldown:suggestion`, config.SUGGESTION_COOLDOWN_MS);
}

export async function tryAcquireFastCueSlot(sessionId: string, cueKey: string): Promise<boolean> {
  const r = await getRedis();
  return r.setCooldown(`session:${sessionId}:cooldown:cue:${cueKey}`, config.FAST_CUE_COOLDOWN_MS);
}

function createRedisAdapter(): RedisAdapter {
  if (shouldUseUpstashRest()) return createUpstashRestAdapter();
  return createSocketAdapter();
}

function shouldUseUpstashRest(): boolean {
  return Boolean(config.UPSTASH_REDIS_REST_URL && config.UPSTASH_REDIS_REST_TOKEN) || /^https?:\/\//i.test(config.REDIS_URL ?? "");
}

function createSocketAdapter(): RedisAdapter {
  const client: RedisClientType = createClient({ url: requireKey(config.REDIS_URL, "REDIS_URL") });
  client.on("error", () => undefined);
  const open = async () => {
    if (!client.isOpen) await client.connect();
    return client;
  };
  return {
    mode: "socket",
    async ping() {
      return (await (await open()).ping()) as string;
    },
    async rPush(key, value) {
      await (await open()).rPush(key, value);
    },
    async lTrim(key, start, stop) {
      await (await open()).lTrim(key, start, stop);
    },
    async expire(key, seconds) {
      await (await open()).expire(key, seconds);
    },
    async lRange(key, start, stop) {
      return (await (await open()).lRange(key, start, stop)) as string[];
    },
    async keys(pattern) {
      return (await (await open()).keys(pattern)) as string[];
    },
    async del(keys) {
      if (keys.length > 0) await (await open()).del(keys);
    },
    async setCooldown(key, ms) {
      const result = await (await open()).set(key, "1", { NX: true, PX: ms });
      return result === "OK";
    },
    async flushDb() {
      await (await open()).flushDb();
    },
    async close() {
      if (client.isOpen) await client.quit();
    },
  };
}

function createUpstashRestAdapter(): RedisAdapter {
  const url = requireKey(config.UPSTASH_REDIS_REST_URL ?? (/^https?:\/\//i.test(config.REDIS_URL ?? "") ? config.REDIS_URL : undefined), "UPSTASH_REDIS_REST_URL");
  const token = requireKey(config.UPSTASH_REDIS_REST_TOKEN, "UPSTASH_REDIS_REST_TOKEN");

  async function command<T>(args: Array<string | number>): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    const body = (await response.json().catch(() => ({}))) as { result?: T; error?: string };
    if (!response.ok || body.error) throw new Error(body.error ?? `Upstash Redis REST request failed with HTTP ${response.status}`);
    return body.result as T;
  }

  return {
    mode: "upstash_rest",
    async ping() {
      return await command<string>(["PING"]);
    },
    async rPush(key, value) {
      await command<number>(["RPUSH", key, value]);
    },
    async lTrim(key, start, stop) {
      await command<string>(["LTRIM", key, start, stop]);
    },
    async expire(key, seconds) {
      await command<number>(["EXPIRE", key, seconds]);
    },
    async lRange(key, start, stop) {
      return await command<string[]>(["LRANGE", key, start, stop]);
    },
    async keys(pattern) {
      return await command<string[]>(["KEYS", pattern]);
    },
    async del(keys) {
      if (keys.length > 0) await command<number>(["DEL", ...keys]);
    },
    async setCooldown(key, ms) {
      return (await command<string | null>(["SET", key, "1", "NX", "PX", ms])) === "OK";
    },
    async flushDb() {
      await command<string>(["FLUSHDB"]);
    },
    async close() {
      return;
    },
  };
}

function contextKey(sessionId: string): string {
  return `session:${sessionId}:context`;
}
