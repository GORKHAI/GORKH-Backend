import os from "node:os";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { config } from "../config.js";
import { db, pool } from "../db/client.js";
import { subagentNotifications, subagentReports, subagentTaskAttempts, subagentTasks } from "../db/schema.js";
import type { SubagentTask } from "./types.js";

const prioritySql = `
  CASE priority
    WHEN 'urgent' THEN 4
    WHEN 'high' THEN 3
    WHEN 'normal' THEN 2
    ELSE 1
  END DESC
`;

export function currentWorkerId(): string {
  return config.SUBAGENT_WORKER_ID ?? `${os.hostname()}-${process.pid}`;
}

export async function claimDueSubagentTasks(workerId = currentWorkerId(), batchSize = config.SUBAGENT_WORKER_BATCH_SIZE): Promise<SubagentTask[]> {
  const leaseMs = config.SUBAGENT_TASK_LEASE_MS;
  const result = await pool.query(
    `
      WITH due AS (
        SELECT id
        FROM subagent_tasks
        WHERE status = 'queued'
          AND (next_run_at IS NULL OR next_run_at <= now())
          AND (locked_until IS NULL OR locked_until <= now())
        ORDER BY ${prioritySql}, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $1
      )
      UPDATE subagent_tasks t
      SET status = 'running',
          started_at = COALESCE(t.started_at, now()),
          locked_by = $2,
          locked_at = now(),
          locked_until = now() + ($3::text || ' milliseconds')::interval,
          lease_token = gen_random_uuid()::text,
          last_heartbeat_at = now(),
          attempt_count = t.attempt_count + 1
      FROM due
      WHERE t.id = due.id
      RETURNING t.*
    `,
    [batchSize, workerId, leaseMs],
  );
  return result.rows.map(rawRowToTask);
}

export async function recordAttemptStarted(task: SubagentTask, workerId = currentWorkerId()): Promise<string> {
  const [attempt] = await db
    .insert(subagentTaskAttempts)
    .values({
      taskId: task.id,
      userId: task.userId,
      workerId,
      attemptNumber: task.attemptCount ?? 1,
      status: "started",
    })
    .returning({ id: subagentTaskAttempts.id });
  return attempt?.id ?? "";
}

export async function recordAttemptFinished(args: {
  attemptId: string;
  status: "completed" | "failed" | "retried" | "canceled" | "expired" | "suppressed";
  errorCode?: string | null;
  errorClass?: string | null;
  errorMessage?: string | null;
  startedAt: number;
}): Promise<void> {
  if (!args.attemptId) return;
  await db
    .update(subagentTaskAttempts)
    .set({
      status: args.status,
      errorCode: args.errorCode ?? null,
      errorClass: args.errorClass ?? null,
      errorMessage: args.errorMessage?.slice(0, 500) ?? null,
      completedAt: new Date(),
      durationMs: Math.max(0, Date.now() - args.startedAt),
    })
    .where(eq(subagentTaskAttempts.id, args.attemptId));
}

export async function queueStatus(userId?: string) {
  const where = userId ? sql`WHERE user_id = ${userId}` : sql``;
  const rows = await pool.query<{ status: string; count: string }>(`
    SELECT status, count(*)::int AS count
    FROM subagent_tasks
    ${userId ? "WHERE user_id = $1" : ""}
    GROUP BY status
    ORDER BY status
  `, userId ? [userId] : []);
  const oldest = await pool.query(
    `
      SELECT status, min(created_at) AS oldest_created_at
      FROM subagent_tasks
      ${userId ? "WHERE user_id = $1" : ""}
      GROUP BY status
      ORDER BY status
    `,
    userId ? [userId] : [],
  );
  void where;
  return {
    runnerMode: config.SUBAGENT_RUNNER_MODE,
    workerId: currentWorkerId(),
    counts: Object.fromEntries(rows.rows.map((row) => [row.status, Number(row.count)])),
    oldest: oldest.rows,
  };
}

export async function deleteSubagentReportsForSession(sessionId: string): Promise<void> {
  const taskRows = await db.select({ id: subagentTasks.id }).from(subagentTasks).where(eq(subagentTasks.sessionId, sessionId));
  await db.delete(subagentReports).where(eq(subagentReports.sessionId, sessionId));
  if (taskRows.length > 0) {
    await db.delete(subagentNotifications).where(inArray(subagentNotifications.taskId, taskRows.map((row) => row.id)));
  }
}

export async function findActiveDuplicateTask(args: { userId: string; idempotencyKey?: string | null; dedupeKey?: string | null }) {
  const keyField = args.idempotencyKey ? subagentTasks.idempotencyKey : args.dedupeKey ? subagentTasks.dedupeKey : null;
  const keyValue = args.idempotencyKey ?? args.dedupeKey;
  if (!keyField || !keyValue) return null;
  const [row] = await db
    .select()
    .from(subagentTasks)
    .where(
      and(
        eq(subagentTasks.userId, args.userId),
        eq(keyField, keyValue),
        inArray(subagentTasks.status, ["queued", "running", "completed", "failed"] as never),
      ),
    )
    .orderBy(desc(subagentTasks.createdAt))
    .limit(1);
  return row ?? null;
}

function rawRowToTask(row: Record<string, unknown>): SubagentTask {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    sessionId: typeof row.session_id === "string" ? row.session_id : null,
    situationBriefId: typeof row.situation_brief_id === "string" ? row.situation_brief_id : null,
    parentTurnId: typeof row.parent_turn_id === "string" ? row.parent_turn_id : null,
    kind: row.kind as SubagentTask["kind"],
    trigger: row.trigger as SubagentTask["trigger"],
    priority: row.priority as SubagentTask["priority"],
    input: row.input,
    policy: row.policy as SubagentTask["policy"],
    timeoutMs: Number(row.timeout_ms),
    attemptCount: Number(row.attempt_count ?? 0),
    maxAttempts: Number(row.max_attempts ?? config.SUBAGENT_DEFAULT_MAX_ATTEMPTS),
    leaseToken: typeof row.lease_token === "string" ? row.lease_token : null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}
