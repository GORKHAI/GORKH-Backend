import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { providerUsageEvents } from "../db/schema.js";
import type { LlmUsage } from "../llm/types.js";

export async function recordProviderUsage(args: {
  userId?: string | null;
  sessionId?: string | null;
  provider: string;
  model?: string | null;
  operation: string;
  usage?: LlmUsage;
  latencyMs?: number | null;
  status: string;
}): Promise<void> {
  await db.insert(providerUsageEvents).values({
    userId: args.userId ?? null,
    sessionId: args.sessionId ?? null,
    provider: args.provider,
    model: args.model ?? null,
    operation: args.operation,
    inputTokens: args.usage?.inputTokens ?? null,
    outputTokens: args.usage?.outputTokens ?? null,
    cachedInputTokens: args.usage?.cachedInputTokens ?? null,
    latencyMs: typeof args.latencyMs === "number" ? Math.round(args.latencyMs) : null,
    estimatedCostUsd: null,
    status: args.status,
  });
}

export async function usageCountForUserToday(userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(providerUsageEvents)
    .where(eq(providerUsageEvents.userId, userId));
  return Number(rows[0]?.count ?? 0);
}
