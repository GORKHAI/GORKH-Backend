import { config } from "../config.js";
import { checkDb, pool } from "../db/client.js";
import { checkRedis, redisConnectionMode } from "../redis.js";
import { selectedLlmStatus } from "../llm/provider.js";
import { researchProviderStatus } from "../research/provider.js";

const startedAt = Date.now();

export interface SubagentQueueMetrics {
  workerId: string;
  runnerMode: string;
  uptimeSeconds: number;
  dbReachable: boolean;
  redisReachable: boolean;
  redisMode: "socket" | "upstash_rest";
  queueCounts: Record<string, number>;
  tasksClaimed: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksRetried: number;
  tasksCanceled: number;
  tasksExpired: number;
  averageTaskDurationMs: number;
  oldestQueuedAgeSeconds: number | null;
  oldestRunningLockAgeSeconds: number | null;
  currentlyRunningCount: number;
  leaseExpiredCount: number;
  recentFailuresCount: number;
  notificationCounts: Record<string, number>;
  retryCounts: Record<string, number>;
  workerHeartbeatSummary: Array<{ workerId: string; runningCount: number; lastHeartbeatAt: string | null; lockedUntil: string | null }>;
  lastHeartbeatAt: string | null;
  researchProviderStatus: ReturnType<typeof researchProviderStatus>;
  llmProviderStatus: ReturnType<typeof selectedLlmStatus>;
  deepgramConfigured: boolean;
}

export async function subagentQueueMetrics(workerId: string): Promise<SubagentQueueMetrics> {
  const [dbReachable, redisReachable] = await Promise.all([checkDb(), checkRedis()]);
  const [
    counts,
    attemptCounts,
    avgDuration,
    oldestQueued,
    oldestRunningLock,
    leaseExpired,
    recentFailures,
    notificationCounts,
    retryCounts,
    heartbeatRows,
  ] = await Promise.all([
    queryCounts("SELECT status, count(*)::int AS count FROM subagent_tasks GROUP BY status"),
    queryCounts("SELECT status, count(*)::int AS count FROM subagent_task_attempts GROUP BY status"),
    pool.query<{ avg_ms: string | null }>("SELECT avg(duration_ms)::numeric AS avg_ms FROM subagent_task_attempts WHERE duration_ms IS NOT NULL"),
    pool.query<{ age_seconds: string | null }>("SELECT extract(epoch from (now() - min(created_at)))::int AS age_seconds FROM subagent_tasks WHERE status = 'queued'"),
    pool.query<{ age_seconds: string | null }>("SELECT extract(epoch from (now() - min(locked_at)))::int AS age_seconds FROM subagent_tasks WHERE status = 'running' AND locked_at IS NOT NULL"),
    pool.query<{ count: string }>("SELECT count(*)::int AS count FROM subagent_tasks WHERE status = 'running' AND locked_until IS NOT NULL AND locked_until < now()"),
    pool.query<{ count: string }>("SELECT count(*)::int AS count FROM subagent_task_attempts WHERE status = 'failed' AND completed_at > now() - interval '1 hour'"),
    queryCounts("SELECT event_type AS status, count(*)::int AS count FROM subagent_notifications WHERE created_at > now() - interval '24 hours' GROUP BY event_type"),
    queryCounts("SELECT coalesce(error_code, 'unknown') AS status, count(*)::int AS count FROM subagent_task_attempts WHERE status = 'retried' GROUP BY coalesce(error_code, 'unknown')"),
    pool.query<{ worker_id: string; running_count: string; last_heartbeat_at: Date | null; locked_until: Date | null }>(
      "SELECT locked_by AS worker_id, count(*)::int AS running_count, max(last_heartbeat_at) AS last_heartbeat_at, max(locked_until) AS locked_until FROM subagent_tasks WHERE status = 'running' AND locked_by IS NOT NULL GROUP BY locked_by ORDER BY locked_by",
    ),
  ]);

  const workerHeartbeatSummary = heartbeatRows.rows.map((row) => ({
    workerId: row.worker_id,
    runningCount: Number(row.running_count),
    lastHeartbeatAt: row.last_heartbeat_at?.toISOString() ?? null,
    lockedUntil: row.locked_until?.toISOString() ?? null,
  }));
  const lastHeartbeatAt =
    workerHeartbeatSummary
      .map((row) => row.lastHeartbeatAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

  return {
    workerId,
    runnerMode: config.SUBAGENT_RUNNER_MODE,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    dbReachable,
    redisReachable,
    redisMode: redisConnectionMode(),
    queueCounts: counts,
    tasksClaimed: sumAttemptStatuses(attemptCounts, ["started", "completed", "failed", "retried", "canceled", "expired", "suppressed"]),
    tasksCompleted: attemptCounts.completed ?? 0,
    tasksFailed: attemptCounts.failed ?? 0,
    tasksRetried: attemptCounts.retried ?? 0,
    tasksCanceled: attemptCounts.canceled ?? 0,
    tasksExpired: attemptCounts.expired ?? 0,
    averageTaskDurationMs: Math.round(Number(avgDuration.rows[0]?.avg_ms ?? 0)),
    oldestQueuedAgeSeconds: numberOrNull(oldestQueued.rows[0]?.age_seconds),
    oldestRunningLockAgeSeconds: numberOrNull(oldestRunningLock.rows[0]?.age_seconds),
    currentlyRunningCount: counts.running ?? 0,
    leaseExpiredCount: Number(leaseExpired.rows[0]?.count ?? 0),
    recentFailuresCount: Number(recentFailures.rows[0]?.count ?? 0),
    notificationCounts,
    retryCounts,
    workerHeartbeatSummary,
    lastHeartbeatAt,
    researchProviderStatus: researchProviderStatus(),
    llmProviderStatus: selectedLlmStatus(),
    deepgramConfigured: Boolean(config.DEEPGRAM_API_KEY),
  };
}

export async function recentSubagentFailures(limit = 25) {
  const result = await pool.query<{
    task_id: string;
    kind: string;
    error_code: string | null;
    error_class: string | null;
    attempt_number: number;
    started_at: Date;
    completed_at: Date | null;
  }>(
    `
      SELECT a.task_id, t.kind, a.error_code, a.error_class, a.attempt_number, a.started_at, a.completed_at
      FROM subagent_task_attempts a
      JOIN subagent_tasks t ON t.id = a.task_id
      WHERE a.status IN ('failed','retried','expired','suppressed')
      ORDER BY a.started_at DESC
      LIMIT $1
    `,
    [limit],
  );
  return result.rows.map((row) => ({
    taskId: row.task_id,
    kind: row.kind,
    errorCode: row.error_code,
    errorClass: row.error_class,
    attemptNumber: row.attempt_number,
    createdAt: row.started_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
  }));
}

async function queryCounts(query: string): Promise<Record<string, number>> {
  const result = await pool.query<{ status: string; count: string }>(query);
  return Object.fromEntries(result.rows.map((row) => [row.status, Number(row.count)]));
}

function sumAttemptStatuses(counts: Record<string, number>, statuses: string[]): number {
  return statuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
}

function numberOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
