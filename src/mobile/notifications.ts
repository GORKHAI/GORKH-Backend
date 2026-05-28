import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  actionProposals,
  commitments,
  dailyBriefs,
  mobileNotifications,
  sessions,
  subagentReports,
  taskItems,
  type MobileNotificationPriority,
} from "../db/schema.js";

export interface MobileCursor {
  createdAt: string;
  id: string;
}

export function encodeCursor(cursor: MobileCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(value?: string): MobileCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<MobileCursor>;
    if (typeof parsed.createdAt === "string" && typeof parsed.id === "string") return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
  return null;
}

export async function createMobileNotification(args: {
  userId: string;
  sessionId?: string | null;
  type: string;
  title: string;
  body?: string | null;
  payload?: Record<string, unknown>;
  priority?: MobileNotificationPriority;
}) {
  const [row] = await db
    .insert(mobileNotifications)
    .values({
      userId: args.userId,
      sessionId: args.sessionId ?? null,
      type: args.type,
      title: args.title,
      body: args.body ?? null,
      payload: args.payload ?? {},
      priority: args.priority ?? "normal",
    })
    .returning();
  return row;
}

export async function listMobileNotifications(userId: string, options: { cursor?: string; limit?: number } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const cursor = decodeCursor(options.cursor);
  const where = cursor
    ? and(eq(mobileNotifications.userId, userId), gt(mobileNotifications.createdAt, new Date(cursor.createdAt)))
    : eq(mobileNotifications.userId, userId);
  const rows = await db.select().from(mobileNotifications).where(where).orderBy(asc(mobileNotifications.createdAt)).limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page,
    cursor: last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : options.cursor ?? null,
    hasMore: rows.length > limit,
  };
}

export async function ackMobileNotification(userId: string, notificationId: string) {
  const now = new Date();
  const [row] = await db
    .update(mobileNotifications)
    .set({ acknowledgedAt: now, readAt: now })
    .where(and(eq(mobileNotifications.id, notificationId), eq(mobileNotifications.userId, userId)))
    .returning();
  return row ?? null;
}

export async function ackMobileNotifications(userId: string, notificationIds: string[]) {
  if (notificationIds.length === 0) return [];
  const now = new Date();
  return db
    .update(mobileNotifications)
    .set({ acknowledgedAt: now, readAt: now })
    .where(and(eq(mobileNotifications.userId, userId), inArray(mobileNotifications.id, notificationIds)))
    .returning();
}

export async function mobileSync(userId: string, options: { cursor?: string; limit?: number } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const cursor = decodeCursor(options.cursor);
  const since = cursor ? new Date(cursor.createdAt) : new Date(0);
  const [notifications, reports, actions, briefs, tasks, commitmentRows, sessionRows] = await Promise.all([
    db.select().from(mobileNotifications).where(and(eq(mobileNotifications.userId, userId), gt(mobileNotifications.createdAt, since))).orderBy(asc(mobileNotifications.createdAt)).limit(limit),
    db.select().from(subagentReports).where(and(eq(subagentReports.userId, userId), gt(subagentReports.createdAt, since))).orderBy(asc(subagentReports.createdAt)).limit(limit),
    db.select().from(actionProposals).where(and(eq(actionProposals.userId, userId), gt(actionProposals.updatedAt, since))).orderBy(asc(actionProposals.updatedAt)).limit(limit),
    db.select().from(dailyBriefs).where(and(eq(dailyBriefs.userId, userId), gt(dailyBriefs.generatedAt, since))).orderBy(asc(dailyBriefs.generatedAt)).limit(limit),
    db.select().from(taskItems).where(and(eq(taskItems.userId, userId), gt(taskItems.updatedAt, since))).orderBy(asc(taskItems.updatedAt)).limit(limit),
    db.select().from(commitments).where(and(eq(commitments.userId, userId), gt(commitments.updatedAt, since))).orderBy(asc(commitments.updatedAt)).limit(limit),
    db.select().from(sessions).where(and(eq(sessions.userId, userId), gt(sessions.startedAt, since))).orderBy(asc(sessions.startedAt)).limit(limit),
  ]);
  const items = [
    ...notifications.map((item) => ({ type: "notification", createdAt: item.createdAt, item })),
    ...reports.map((item) => ({ type: "subagent_report", createdAt: item.createdAt, item })),
    ...actions.map((item) => ({ type: "action_proposal", createdAt: item.updatedAt, item })),
    ...briefs.map((item) => ({ type: "daily_brief", createdAt: item.generatedAt, item })),
    ...tasks.map((item) => ({ type: "task", createdAt: item.updatedAt, item })),
    ...commitmentRows.map((item) => ({ type: "commitment", createdAt: item.updatedAt, item })),
    ...sessionRows.map((item) => ({ type: "session", createdAt: item.startedAt, item: redactSession(item) })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(0, limit);
  const last = items.at(-1);
  return {
    cursor: last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: String((last.item as { id?: string }).id ?? "") }) : options.cursor ?? null,
    items: items.map(({ type, item }) => ({ type, item })),
    hasMore: notifications.length + reports.length + actions.length + briefs.length + tasks.length + commitmentRows.length + sessionRows.length > limit,
  };
}

function redactSession<T extends { id: string; status: string; retentionPolicy: string; startedAt: Date; endedAt: Date | null }>(session: T) {
  return {
    id: session.id,
    status: session.status,
    retentionPolicy: session.retentionPolicy,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
  };
}
