import { sql } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { providerUsageEvents } from "../db/schema.js";

export function governorStatus() {
  return {
    enabled: config.GOVERNOR_ENABLED,
    mode: config.GOVERNOR_MODE,
    preferDeterministic: config.GOVERNOR_PREFER_DETERMINISTIC,
    preferCheapModel: config.GOVERNOR_PREFER_CHEAP_MODEL,
    budgets: {
      dailyLlmUsd: config.GOVERNOR_DAILY_LLM_BUDGET_USD,
      dailyResearchUsd: config.GOVERNOR_DAILY_RESEARCH_BUDGET_USD,
    },
    latencyTargets: {
      maxLlmLatencyMs: config.GOVERNOR_MAX_LLM_LATENCY_MS,
      maxResearchLatencyMs: config.GOVERNOR_MAX_RESEARCH_LATENCY_MS,
    },
  };
}

export async function providerUsageSummary(userId?: string | null) {
  const rows = await db.execute(sql`
    SELECT provider, operation, status, count(*)::int AS count,
           coalesce(sum(input_tokens), 0)::int AS input_tokens,
           coalesce(sum(output_tokens), 0)::int AS output_tokens,
           avg(latency_ms)::int AS avg_latency_ms
    FROM provider_usage_events
    WHERE created_at > now() - interval '24 hours'
      AND (${userId ?? null}::uuid IS NULL OR user_id = ${userId ?? null}::uuid)
    GROUP BY provider, operation, status
    ORDER BY provider, operation, status
  `);
  return { windowHours: 24, events: rows.rows };
}
