import { and, asc, eq, gt, sql } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { subagentNotifications, subagentTasks } from "../db/schema.js";
import type { SubagentNotificationPayload, SubagentTask } from "./types.js";

type NotificationListener = (event: {
  taskId: string;
  eventType: string;
  payload: SubagentNotificationPayload;
}) => void;

const listeners = new Map<string, Set<NotificationListener>>();

export async function createSubagentNotification(
  task: Pick<SubagentTask, "id" | "userId" | "sessionId">,
  eventType: string,
  payload: SubagentNotificationPayload,
): Promise<void> {
  await db.insert(subagentNotifications).values({
    taskId: task.id,
    userId: task.userId,
    sessionId: task.sessionId ?? null,
    eventType,
    payload,
  });
  for (const listener of listeners.get(task.id) ?? []) {
    listener({ taskId: task.id, eventType, payload });
  }
}

export function addSubagentNotificationListener(taskId: string, listener: NotificationListener): () => void {
  const set = listeners.get(taskId) ?? new Set<NotificationListener>();
  set.add(listener);
  listeners.set(taskId, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(taskId);
  };
}

export async function listSubagentNotifications(args: {
  userId: string;
  since?: Date;
  taskId?: string;
  limit?: number;
}) {
  const conditions = [eq(subagentNotifications.userId, args.userId)];
  if (args.since) conditions.push(gt(subagentNotifications.createdAt, args.since));
  if (args.taskId) {
    const [task] = await db
      .select({ id: subagentTasks.id })
      .from(subagentTasks)
      .where(and(eq(subagentTasks.id, args.taskId), eq(subagentTasks.userId, args.userId)))
      .limit(1);
    if (!task) return null;
    conditions.push(eq(subagentNotifications.taskId, args.taskId));
  }
  return db
    .select()
    .from(subagentNotifications)
    .where(and(...conditions))
    .orderBy(asc(subagentNotifications.createdAt))
    .limit(Math.min(Math.max(args.limit ?? 100, 1), 500));
}

export async function cleanupSubagentNotifications(retentionHours = config.SUBAGENT_NOTIFICATION_RETENTION_HOURS): Promise<number> {
  const result = await db.execute(sql`
    DELETE FROM subagent_notifications
    WHERE created_at < now() - (${retentionHours}::text || ' hours')::interval
  `);
  return Number((result as { rowCount?: number }).rowCount ?? 0);
}
