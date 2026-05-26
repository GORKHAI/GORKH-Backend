import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { sessions, subagentEvents, subagentReports, subagentTasks } from "../db/schema.js";
import { createSubagentNotification } from "./notifications.js";
import type { SubagentReport, SubagentTask } from "./types.js";

export async function canSubagentWrite(task: Pick<SubagentTask, "id" | "sessionId">): Promise<boolean> {
  const [row] = await db.select({ status: subagentTasks.status }).from(subagentTasks).where(eq(subagentTasks.id, task.id)).limit(1);
  if (!row || row.status === "canceled" || row.status === "expired" || row.status === "suppressed") return false;
  if (!task.sessionId) return true;
  const [session] = await db.select({ status: sessions.status }).from(sessions).where(eq(sessions.id, task.sessionId)).limit(1);
  return session?.status === "active" || session?.status === "saved";
}

export async function persistSubagentEvent(task: Pick<SubagentTask, "id" | "userId" | "sessionId">, eventType: string, payload: unknown): Promise<void> {
  await db.insert(subagentEvents).values({ taskId: task.id, userId: task.userId, sessionId: task.sessionId ?? null, eventType, payload });
  if (eventType === "report") return;
  await createSubagentNotification(task, `subagent_${eventType}`, { taskId: task.id, ...(typeof payload === "object" && payload ? (payload as Record<string, unknown>) : { message: String(payload) }) }).catch(
    () => undefined,
  );
}

export async function persistSubagentReport(task: SubagentTask, report: SubagentReport): Promise<void> {
  await db.insert(subagentReports).values({
    taskId: task.id,
    userId: task.userId,
    sessionId: task.sessionId ?? null,
    kind: report.kind,
    status: report.status,
    title: report.title,
    summary: report.summary,
    findings: report.findings,
    recommendedMainAgentMessage: report.recommendedMainAgentMessage ?? null,
    safetyNotes: report.safetyNotes,
    providerStatus: report.providerStatus ?? null,
  });
  await createSubagentNotification(task, report.status === "completed" ? "subagent_report" : "subagent_failed", {
    taskId: task.id,
    kind: report.kind,
    status: report.status,
    message: report.summary,
    report,
  }).catch(() => undefined);
}

export async function suppressSubagentsForSession(sessionId: string): Promise<void> {
  await db.update(subagentTasks).set({ status: "suppressed", completedAt: new Date(), error: "session_not_active" }).where(eq(subagentTasks.sessionId, sessionId));
  await db.delete(subagentReports).where(eq(subagentReports.sessionId, sessionId));
}
