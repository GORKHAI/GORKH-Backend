import { and, asc, desc, eq } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { subagentEvents, subagentReports, subagentTasks } from "../db/schema.js";
import { logBrainAuditEvent } from "../brain/audit.js";
import { cancelTaskSignal } from "./cancellation.js";
import { persistSubagentEvent } from "./lifecycle.js";
import { addSubagentNotificationListener } from "./notifications.js";
import { deleteSubagentReportsForSession, findActiveDuplicateTask } from "./queue.js";
import { triggerSubagentWorkerOnce } from "./worker.js";
import { createSubagentTaskSchema, type CreateSubagentTaskInput, type SubagentProgress, type SubagentTask } from "./types.js";

type ProgressListener = (event: SubagentProgress) => void;

export async function createSubagentTask(userId: string, input: CreateSubagentTaskInput, listener?: ProgressListener): Promise<SubagentTask> {
  if (!config.SUBAGENTS_ENABLED) throw new Error("Subagents are disabled");
  const parsed = createSubagentTaskSchema.parse(input);
  const existing = await findActiveDuplicateTask({
    userId,
    idempotencyKey: parsed.idempotencyKey ?? null,
    dedupeKey: parsed.dedupeKey ?? null,
  });
  if (existing) {
    const task = rowToTask(existing);
    if (listener) addSubagentListener(task.id, listener);
    return task;
  }
  const timeoutMs = parsed.timeoutMs ?? (parsed.kind === "research" ? config.SUBAGENT_RESEARCH_TIMEOUT_MS : config.SUBAGENT_DEFAULT_TIMEOUT_MS);
  const [row] = await db
    .insert(subagentTasks)
    .values({
      userId,
      sessionId: parsed.sessionId ?? null,
      situationBriefId: parsed.situationBriefId ?? null,
      parentTurnId: parsed.parentTurnId ?? null,
      kind: parsed.kind,
      trigger: parsed.trigger,
      priority: parsed.priority,
      status: "queued",
      input: parsed.input,
      policy: parsed.policy,
      timeoutMs,
      maxAttempts: parsed.maxAttempts ?? config.SUBAGENT_DEFAULT_MAX_ATTEMPTS,
      nextRunAt: new Date(),
      idempotencyKey: parsed.idempotencyKey ?? null,
      dedupeKey: parsed.dedupeKey ?? null,
    })
    .returning();
  if (!row) throw new Error("failed to create subagent task");
  const task = rowToTask(row);
  if (listener) addSubagentListener(task.id, listener);
  await persistSubagentEvent(task, "queued", { taskId: task.id, kind: task.kind, trigger: task.trigger, status: "queued", message: "Task queued." });
  await logBrainAuditEvent({ userId, sessionId: task.sessionId ?? null, eventType: "subagent_task_queued", payload: { taskId: task.id, kind: task.kind } }).catch(() => null);
  if (config.SUBAGENT_RUNNER_MODE !== "disabled") triggerSubagentWorkerOnce();
  return task;
}

export function addSubagentListener(taskId: string, listener: ProgressListener): () => void {
  return addSubagentNotificationListener(taskId, ({ eventType, payload }) => {
    listener({
      taskId,
      kind: (payload.kind ?? "research") as never,
      status: typeof payload.status === "string" ? payload.status : eventType.replace(/^subagent_/, ""),
      message: typeof payload.message === "string" ? payload.message : eventType,
    });
  });
}

export async function cancelSubagentTask(userId: string, taskId: string): Promise<boolean> {
  const [task] = await db.select().from(subagentTasks).where(and(eq(subagentTasks.id, taskId), eq(subagentTasks.userId, userId))).limit(1);
  if (!task) return false;
  cancelTaskSignal(taskId);
  await db
    .update(subagentTasks)
    .set({
      status: "canceled",
      canceledAt: new Date(),
      completedAt: new Date(),
      error: "canceled",
      errorCode: "canceled",
      errorClass: "user_cancel",
      lockedBy: null,
      lockedAt: null,
      lockedUntil: null,
      leaseToken: null,
    })
    .where(eq(subagentTasks.id, taskId));
  await persistSubagentEvent(rowToTask(task), "canceled", { taskId, kind: task.kind, status: "canceled", message: "Task canceled.", reason: "user_cancel" }).catch(() => undefined);
  return true;
}

export async function listSubagentTasks(userId: string) {
  return db.select().from(subagentTasks).where(eq(subagentTasks.userId, userId)).orderBy(desc(subagentTasks.createdAt)).limit(100);
}

export async function getOwnedSubagentTask(userId: string, taskId: string) {
  const [task] = await db.select().from(subagentTasks).where(and(eq(subagentTasks.id, taskId), eq(subagentTasks.userId, userId))).limit(1);
  return task ?? null;
}

export async function getOwnedSubagentReport(userId: string, taskId: string) {
  const [task] = await db.select({ id: subagentTasks.id }).from(subagentTasks).where(and(eq(subagentTasks.id, taskId), eq(subagentTasks.userId, userId))).limit(1);
  if (!task) return null;
  const [report] = await db.select().from(subagentReports).where(eq(subagentReports.taskId, taskId)).orderBy(desc(subagentReports.createdAt)).limit(1);
  return report ?? null;
}

export async function getOwnedSubagentEvents(userId: string, taskId: string) {
  const [task] = await db.select({ id: subagentTasks.id }).from(subagentTasks).where(and(eq(subagentTasks.id, taskId), eq(subagentTasks.userId, userId))).limit(1);
  if (!task) return null;
  return db.select().from(subagentEvents).where(eq(subagentEvents.taskId, taskId)).orderBy(asc(subagentEvents.createdAt));
}

export async function cancelSubagentsForSession(sessionId: string): Promise<void> {
  const rows = await db.select({ id: subagentTasks.id }).from(subagentTasks).where(eq(subagentTasks.sessionId, sessionId));
  for (const row of rows) cancelTaskSignal(row.id);
  await db
    .update(subagentTasks)
    .set({
      status: "suppressed",
      completedAt: new Date(),
      error: "session_not_active",
      errorCode: "session_not_active",
      errorClass: "privacy",
      lockedBy: null,
      lockedAt: null,
      lockedUntil: null,
      leaseToken: null,
    })
    .where(eq(subagentTasks.sessionId, sessionId));
  await deleteSubagentReportsForSession(sessionId);
}

function rowToTask(row: typeof subagentTasks.$inferSelect): SubagentTask {
  return {
    id: row.id,
    userId: row.userId,
    sessionId: row.sessionId,
    situationBriefId: row.situationBriefId,
    parentTurnId: row.parentTurnId,
    kind: row.kind,
    trigger: row.trigger,
    priority: row.priority,
    input: row.input,
    policy: row.policy as SubagentTask["policy"],
    timeoutMs: row.timeoutMs,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    leaseToken: row.leaseToken,
    createdAt: row.createdAt.toISOString(),
  };
}
