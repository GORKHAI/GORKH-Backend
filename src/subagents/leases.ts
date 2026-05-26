import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { subagentTasks } from "../db/schema.js";

export async function heartbeatSubagentLease(taskId: string, leaseToken: string, leaseMs: number): Promise<boolean> {
  const result = await db
    .update(subagentTasks)
    .set({
      lastHeartbeatAt: new Date(),
      lockedUntil: sql`now() + (${leaseMs}::text || ' milliseconds')::interval`,
    })
    .where(sql`${subagentTasks.id} = ${taskId} AND ${subagentTasks.leaseToken} = ${leaseToken} AND ${subagentTasks.status} = 'running'`);
  return Number((result as { rowCount?: number }).rowCount ?? 0) > 0;
}

export async function reclaimExpiredSubagentLeases(): Promise<number> {
  const result = await db
    .update(subagentTasks)
    .set({
      status: "queued",
      lockedAt: null,
      lockedUntil: null,
      lockedBy: null,
      leaseToken: null,
      nextRunAt: new Date(),
      errorCode: "lease_expired",
      errorClass: "transient",
      lastError: "Worker lease expired before task completed.",
    })
    .where(sql`${subagentTasks.status} = 'running' AND ${subagentTasks.lockedUntil} IS NOT NULL AND ${subagentTasks.lockedUntil} < now()`);
  return Number((result as { rowCount?: number }).rowCount ?? 0);
}

export async function getTaskStatus(taskId: string): Promise<string | null> {
  const [row] = await db.select({ status: subagentTasks.status }).from(subagentTasks).where(eq(subagentTasks.id, taskId)).limit(1);
  return row?.status ?? null;
}
