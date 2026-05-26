import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config, requireKey } from "../config.js";
import * as schema from "./schema.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: requireKey(config.DATABASE_URL, "DATABASE_URL"),
});

export const db = drizzle(pool, { schema });

export async function checkDb(): Promise<boolean> {
  try {
    await pool.query("select 1");
    return true;
  } catch {
    return false;
  }
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
