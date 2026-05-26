import pg from "pg";
import { config, requireKey } from "../config.js";
import { checkRedis } from "../redis.js";

const { Pool } = pg;

async function main(): Promise<void> {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const db = await dbReady();
    const redis = await redisReady();
    if (db && redis) {
      console.log("wait:infra: postgres and redis are ready");
      return;
    }
    console.log(`wait:infra: waiting for services (db=${db}, redis=${redis})`);
    await delay(2000);
  }
  throw new Error("Postgres and Redis did not become ready within 60s");
}

async function dbReady(): Promise<boolean> {
  const pool = new Pool({ connectionString: requireKey(config.DATABASE_URL, "DATABASE_URL") });
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function redisReady(): Promise<boolean> {
  try {
    return await checkRedis();
  } catch {
    return false;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error(`wait:infra: failed: ${(err as Error).message}`);
  process.exit(1);
});
