import pg from "pg";
import { config, requireKey } from "../config.js";
import { checkRedis as checkRedisAdapter, redisConnectionMode } from "../redis.js";
import { connectTcp } from "./infra-utils.js";

const { Pool } = pg;

async function main(): Promise<void> {
  const results: Array<{ name: string; ok: boolean; detail: string }> = [];

  results.push(await checkConfiguredTcp("postgres tcp", requireKey(config.DATABASE_URL, "DATABASE_URL")));
  if (redisConnectionMode() === "socket") {
    results.push(await checkConfiguredTcp("redis tcp", requireKey(config.REDIS_URL, "REDIS_URL")));
  } else {
    results.push({ name: "redis transport", ok: true, detail: "using Upstash REST" });
  }
  results.push(await checkDb());
  results.push(await checkRedis());

  for (const result of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}: ${result.detail}`);
  }
  if (results.some((result) => !result.ok)) process.exit(1);
}

async function checkTcp(name: string, host: string, port: number) {
  try {
    await connectTcp(host, port, 2000);
    return { name, ok: true, detail: `${host}:${port} reachable` };
  } catch (err) {
    return { name, ok: false, detail: String((err as Error).message) };
  }
}

async function checkConfiguredTcp(name: string, url: string) {
  const parsed = new URL(url);
  const port = parsed.port ? Number(parsed.port) : parsed.protocol.startsWith("redis") ? 6379 : 5432;
  return checkTcp(name, parsed.hostname, port);
}

async function checkDb() {
  const pool = new Pool({ connectionString: requireKey(config.DATABASE_URL, "DATABASE_URL") });
  try {
    await pool.query("SELECT 1");
    return { name: "postgres query", ok: true, detail: "SELECT 1 succeeded" };
  } catch (err) {
    return { name: "postgres query", ok: false, detail: String((err as Error).message) };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function checkRedis() {
  try {
    const ok = await checkRedisAdapter();
    return { name: "redis ping", ok, detail: ok ? "PING returned PONG" : "PING failed" };
  } catch (err) {
    return { name: "redis ping", ok: false, detail: String((err as Error).message) };
  }
}

main().catch((err) => {
  console.error(`check:infra: failed: ${(err as Error).message}`);
  process.exit(1);
});
