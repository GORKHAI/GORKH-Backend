import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { providerUsageEvents } from "../db/schema.js";
import type { LlmUsage } from "../llm/types.js";
import { config } from "../config.js";

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
  const { start, end } = utcDayWindow();
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(providerUsageEvents)
    .where(and(eq(providerUsageEvents.userId, userId), gte(providerUsageEvents.createdAt, start), lt(providerUsageEvents.createdAt, end)));
  return Number(rows[0]?.count ?? 0);
}

export async function usageCountForUserTodayByOperation(userId: string, operationKind: "llm" | "research"): Promise<number> {
  const { start, end } = utcDayWindow();
  const opPattern = operationKind === "llm" ? "%complete%" : "%research%";
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(providerUsageEvents)
    .where(
      and(
        eq(providerUsageEvents.userId, userId),
        gte(providerUsageEvents.createdAt, start),
        lt(providerUsageEvents.createdAt, end),
        sql`${providerUsageEvents.operation} ILIKE ${opPattern}`,
      ),
    );
  return Number(rows[0]?.count ?? 0);
}

export async function governorBudgetStatus(userId: string) {
  const [llmRequestsUsed, researchRequestsUsed] = await Promise.all([
    usageCountForUserTodayByOperation(userId, "llm"),
    usageCountForUserTodayByOperation(userId, "research"),
  ]);
  return {
    userId,
    date: utcDayWindow().start.toISOString().slice(0, 10),
    llmRequestsUsed,
    llmRequestLimit: config.GOVERNOR_DAILY_LLM_REQUEST_LIMIT,
    researchRequestsUsed,
    researchRequestLimit: config.GOVERNOR_DAILY_RESEARCH_REQUEST_LIMIT,
    estimatedCostUsd: null,
    budgetExceeded: {
      llm: llmRequestsUsed >= config.GOVERNOR_DAILY_LLM_REQUEST_LIMIT,
      research: researchRequestsUsed >= config.GOVERNOR_DAILY_RESEARCH_REQUEST_LIMIT,
    },
  };
}

export async function assertGovernorBudgetAvailable(userId: string | undefined | null, operationKind: "llm" | "research"): Promise<void> {
  if (!config.GOVERNOR_ENABLED || !userId) return;
  const status = await governorBudgetStatus(userId);
  if (operationKind === "llm" && status.budgetExceeded.llm) throw new GovernorBudgetExceededError("llm");
  if (operationKind === "research" && status.budgetExceeded.research) throw new GovernorBudgetExceededError("research");
}

export class GovernorBudgetExceededError extends Error {
  readonly code = "budget_exceeded";
  constructor(readonly operationKind: "llm" | "research") {
    super(`${operationKind} daily request budget exceeded`);
  }
}

function utcDayWindow(now = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}
