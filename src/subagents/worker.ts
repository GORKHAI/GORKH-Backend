import { and, eq, sql } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { sessions, subagentTasks } from "../db/schema.js";
import { cancelTaskSignal, clearTaskController, createTaskController } from "./cancellation.js";
import { canSubagentWrite, persistSubagentEvent, persistSubagentReport } from "./lifecycle.js";
import { getTaskStatus, heartbeatSubagentLease } from "./leases.js";
import { evaluateSubagentPolicy } from "./policy.js";
import { claimDueSubagentTasks, currentWorkerId, recordAttemptFinished, recordAttemptStarted } from "./queue.js";
import { getSubagentWorker } from "./registry.js";
import { trimSubagentReport } from "./reporter.js";
import { isNonRetryableErrorCode, retryDelayMs } from "./retry.js";
import type { SubagentReport, SubagentTask } from "./types.js";

let loopTimer: NodeJS.Timeout | null = null;
let loopRunning = false;

export async function processDueSubagentTasksOnce(args: { workerId?: string; batchSize?: number } = {}): Promise<number> {
  if (!config.SUBAGENTS_ENABLED || config.SUBAGENT_RUNNER_MODE === "disabled") return 0;
  const workerId = args.workerId ?? currentWorkerId();
  const tasks = await claimDueSubagentTasks(workerId, args.batchSize ?? config.SUBAGENT_WORKER_BATCH_SIZE);
  await Promise.all(tasks.map((task) => executeClaimedTask(task, workerId)));
  return tasks.length;
}

export function triggerSubagentWorkerOnce(): void {
  if (!config.SUBAGENTS_ENABLED || config.SUBAGENT_RUNNER_MODE === "disabled") return;
  setTimeout(() => {
    void processDueSubagentTasksOnce().catch((err) => {
      console.warn(`subagent worker batch failed: ${(err as Error).message}`);
    });
  }, 0);
}

export function startSubagentWorkerLoop(): () => void {
  if (!config.SUBAGENTS_ENABLED || config.SUBAGENT_RUNNER_MODE === "disabled") return () => undefined;
  if (loopTimer) return stopSubagentWorkerLoop;
  loopRunning = true;
  const tick = async () => {
    if (!loopRunning) return;
    try {
      await processDueSubagentTasksOnce();
    } catch (err) {
      console.warn(`subagent worker loop failed: ${(err as Error).message}`);
    } finally {
      if (loopRunning) loopTimer = setTimeout(tick, config.SUBAGENT_WORKER_POLL_MS);
    }
  };
  loopTimer = setTimeout(tick, config.SUBAGENT_WORKER_POLL_MS);
  return stopSubagentWorkerLoop;
}

export function stopSubagentWorkerLoop(): void {
  loopRunning = false;
  if (loopTimer) clearTimeout(loopTimer);
  loopTimer = null;
}

async function executeClaimedTask(task: SubagentTask, workerId: string): Promise<void> {
  const startedAt = Date.now();
  const attemptId = await recordAttemptStarted(task, workerId);
  const controller = createTaskController(task.id);
  const heartbeat = task.leaseToken
    ? setInterval(() => {
        void heartbeatSubagentLease(task.id, task.leaseToken ?? "", config.SUBAGENT_TASK_LEASE_MS).catch(() => undefined);
      }, config.SUBAGENT_TASK_HEARTBEAT_MS)
    : null;
  const timeout = setTimeout(() => controller.abort(), task.timeoutMs);

  try {
    const policy = evaluateSubagentPolicy(task);
    if (!policy.allowed) {
      const report = trimSubagentReport(policyFailureReport(task, policy.reason, "policy_denied"));
      await finalizeTaskWithReport(task, report, workerId, "suppressed", attemptId, startedAt, "policy_denied", "policy");
      return;
    }

    await persistSubagentEvent(task, "started", { taskId: task.id, kind: task.kind, status: "running", message: "Task started.", workerId });
    const worker = getSubagentWorker(task.kind);
    const report = trimSubagentReport(
      await worker(task, {
        signal: controller.signal,
        emitProgress: (message) => persistSubagentEvent(task, "progress", { taskId: task.id, kind: task.kind, status: "running", message }),
      }),
    );
    if (controller.signal.aborted) {
      await expireOrCancelTask(task, attemptId, startedAt);
      return;
    }
    if (!(await canSubagentWrite(task))) {
      await suppressTask(task, attemptId, startedAt, workerId);
      return;
    }
    const finalStatus = report.status === "completed" ? "completed" : "failed";
    const errorCode = report.providerStatus?.errorCode ?? null;
    await finalizeTaskWithReport(task, report, workerId, finalStatus, attemptId, startedAt, errorCode, errorCode ? "provider" : null);
  } catch (err) {
    if (controller.signal.aborted) {
      await expireOrCancelTask(task, attemptId, startedAt);
      return;
    }
    await handleThrownTaskError(task, err as Error, workerId, attemptId, startedAt);
  } finally {
    clearTimeout(timeout);
    if (heartbeat) clearInterval(heartbeat);
    clearTaskController(task.id);
  }
}

async function finalizeTaskWithReport(
  task: SubagentTask,
  report: SubagentReport,
  workerId: string,
  status: "completed" | "failed" | "suppressed",
  attemptId: string,
  startedAt: number,
  errorCode: string | null,
  errorClass: string | null,
): Promise<void> {
  if (!(await leaseCanComplete(task))) {
    console.warn(`subagent late completion ignored taskId=${task.id}`);
    await recordAttemptFinished({ attemptId, status: "suppressed", errorCode: "stale_lease", errorClass: "lease", errorMessage: "stale_lease", startedAt });
    return;
  }
  await persistSubagentReport(task, report);
  await persistSubagentEvent(task, "report", { taskId: task.id, kind: task.kind, status: report.status, title: report.title, message: report.summary });
  await db
    .update(subagentTasks)
    .set({
      status,
      completedAt: new Date(),
      completedBy: workerId,
      error: errorCode,
      errorCode,
      errorClass,
      lastError: report.summary,
      lockedBy: null,
      lockedAt: null,
      lockedUntil: null,
      leaseToken: null,
    })
    .where(eq(subagentTasks.id, task.id));
  await recordAttemptFinished({ attemptId, status, errorCode, errorClass, errorMessage: report.summary, startedAt });
}

async function leaseCanComplete(task: SubagentTask): Promise<boolean> {
  if (!task.leaseToken) return true;
  const [row] = await db
    .select({ id: subagentTasks.id })
    .from(subagentTasks)
    .where(and(eq(subagentTasks.id, task.id), eq(subagentTasks.status, "running"), eq(subagentTasks.leaseToken, task.leaseToken)))
    .limit(1);
  return Boolean(row);
}

async function handleThrownTaskError(task: SubagentTask, err: Error, workerId: string, attemptId: string, startedAt: number): Promise<void> {
  const code = errorCodeFromMessage(err.message);
  const attemptNumber = task.attemptCount ?? 1;
  const maxAttempts = task.maxAttempts ?? config.SUBAGENT_DEFAULT_MAX_ATTEMPTS;
  if (!isNonRetryableErrorCode(code) && attemptNumber < maxAttempts) {
    const delay = retryDelayMs(attemptNumber);
    await db
      .update(subagentTasks)
      .set({
        status: "queued",
        nextRunAt: sql`now() + (${delay}::text || ' milliseconds')::interval`,
        lockedBy: null,
        lockedAt: null,
        lockedUntil: null,
        leaseToken: null,
        errorCode: code,
        errorClass: "transient",
        lastError: err.message.slice(0, 500),
      })
      .where(eq(subagentTasks.id, task.id));
    await persistSubagentEvent(task, "progress", { taskId: task.id, kind: task.kind, status: "queued", message: "Task will retry.", delayMs: delay });
    await recordAttemptFinished({ attemptId, status: "retried", errorCode: code, errorClass: "transient", errorMessage: err.message, startedAt });
    return;
  }
  const report = trimSubagentReport(policyFailureReport(task, err.message, code));
  await finalizeTaskWithReport(task, report, workerId, "failed", attemptId, startedAt, code, isNonRetryableErrorCode(code) ? "non_retryable" : "transient");
}

async function expireOrCancelTask(task: SubagentTask, attemptId: string, startedAt: number): Promise<void> {
  const status = (await getTaskStatus(task.id)) === "canceled" ? "canceled" : "expired";
  await db
    .update(subagentTasks)
    .set({
      status,
      completedAt: new Date(),
      error: status,
      errorCode: status,
      errorClass: status,
      lockedBy: null,
      lockedAt: null,
      lockedUntil: null,
      leaseToken: null,
    })
    .where(eq(subagentTasks.id, task.id));
  await persistSubagentEvent(task, status, { taskId: task.id, kind: task.kind, status, message: status === "expired" ? "Task timed out." : "Task canceled." });
  await recordAttemptFinished({ attemptId, status, errorCode: status, errorClass: status, errorMessage: status, startedAt });
}

async function suppressTask(task: SubagentTask, attemptId: string, startedAt: number, workerId: string): Promise<void> {
  cancelTaskSignal(task.id);
  await db
    .update(subagentTasks)
    .set({
      status: "suppressed",
      completedAt: new Date(),
      completedBy: workerId,
      error: "session_not_active",
      errorCode: "session_not_active",
      errorClass: "privacy",
      lockedBy: null,
      lockedAt: null,
      lockedUntil: null,
      leaseToken: null,
    })
    .where(eq(subagentTasks.id, task.id));
  await persistSubagentEvent(task, "suppressed", { taskId: task.id, kind: task.kind, status: "suppressed", message: "Task suppressed because the session is not active." });
  await recordAttemptFinished({ attemptId, status: "suppressed", errorCode: "session_not_active", errorClass: "privacy", errorMessage: "session_not_active", startedAt });
}

export async function suppressTasksForInactiveSessions(): Promise<number> {
  const result = await db
    .update(subagentTasks)
    .set({ status: "suppressed", completedAt: new Date(), error: "session_not_active", errorCode: "session_not_active", errorClass: "privacy" })
    .where(sql`${subagentTasks.sessionId} IS NOT NULL AND ${subagentTasks.status} IN ('queued','running') AND EXISTS (
      SELECT 1 FROM ${sessions} s WHERE s.id = ${subagentTasks.sessionId} AND s.status IN ('discarded','interrupted')
    )`);
  return Number((result as { rowCount?: number }).rowCount ?? 0);
}

function errorCodeFromMessage(message: string): string {
  if (/provider.*not configured|not configured/i.test(message)) return "provider_not_configured";
  if (/policy|not allowed/i.test(message)) return "policy_denied";
  return "worker_error";
}

function policyFailureReport(task: SubagentTask, reason: string, errorCode: string): SubagentReport {
  return {
    taskId: task.id,
    kind: task.kind,
    status: errorCode === "policy_denied" ? "suppressed" : "failed",
    title: errorCode === "policy_denied" ? "Subagent suppressed" : "Subagent failed",
    summary: reason,
    findings: [],
    recommendedMainAgentMessage:
      errorCode === "provider_not_configured"
        ? "I can't verify live web sources yet because the provider is not configured."
        : "That background task could not be completed safely.",
    safetyNotes: ["Subagents cannot bypass main-agent safety policy.", "No citations or reports were fabricated."],
    providerStatus: errorCode === "provider_not_configured" ? { provider: "unknown", configured: false, errorCode } : undefined,
    createdAt: new Date().toISOString(),
  };
}
