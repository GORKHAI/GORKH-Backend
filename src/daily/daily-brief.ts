import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { commitments, dailyBriefs, followupSuggestions, situationBriefs, taskItems, type DailyBrief } from "../db/schema.js";
import { summarizeHumanContext } from "../human/profile.js";
import { rankTasks } from "./priority-ranker.js";
import type { DailyBriefDraft, DailyBriefSection } from "./types.js";

export async function buildDailyBriefDraft(userId: string, date = new Date()): Promise<DailyBriefDraft> {
  const todayStart = startOfUtcDay(date);
  const [profile, tasks, openCommitments, followups, situations] = await Promise.all([
    summarizeHumanContext(userId).catch(() => null),
    db.select().from(taskItems).where(and(eq(taskItems.userId, userId), inArray(taskItems.status, ["proposed", "accepted", "scheduled"]))).orderBy(desc(taskItems.suggestedAt)),
    db.select().from(commitments).where(and(eq(commitments.userId, userId), inArray(commitments.status, ["proposed", "confirmed", "overdue"]))).orderBy(asc(commitments.dueAt)),
    db.select().from(followupSuggestions).where(and(eq(followupSuggestions.userId, userId), eq(followupSuggestions.status, "proposed"))).orderBy(desc(followupSuggestions.createdAt)),
    db.select().from(situationBriefs).where(and(eq(situationBriefs.userId, userId), gte(situationBriefs.scheduledAt, todayStart))).orderBy(asc(situationBriefs.scheduledAt)).limit(5),
  ]);
  const ranked = rankTasks(tasks).slice(0, 8);
  const sections: DailyBriefSection[] = [
    { title: "Today's priorities", items: ranked.slice(0, 5).map((task) => labelWithDue(task.title, task.dueAt)) },
    { title: "Upcoming situations", items: situations.map((situation) => `${situation.description}${situation.scheduledAt ? ` (${situation.scheduledAt.toISOString()})` : ""}`) },
    { title: "Open commitments", items: openCommitments.slice(0, 6).map((commitment) => labelWithDue(commitment.title, commitment.dueAt)) },
    { title: "Follow-ups", items: followups.slice(0, 5).map((followup) => followup.reason) },
    { title: "Waiting on others", items: openCommitments.filter((c) => c.owner && c.owner !== "me").slice(0, 5).map((c) => c.title) },
    { title: "Risk items", items: openCommitments.filter((c) => c.sensitivity !== "low").slice(0, 5).map((c) => `${c.title} (${c.sensitivity})`) },
    { title: "Suggested next actions", items: ranked.slice(0, 3).map((task) => `Review and accept: ${task.title}`) },
    { title: "Stress/load note", items: profile?.stressSupportOptIn ? ["Keep the day plan short and leave buffer before high-stakes situations."] : [] },
    { title: "Research/watch items", items: [] },
  ];
  const nonEmpty = sections.map((section) => ({ ...section, items: section.items.length > 0 ? section.items : ["None currently."] }));
  return {
    summary: ranked.length > 0 ? `You have ${ranked.length} open task candidates and ${openCommitments.length} open commitments.` : "No urgent daily-life items are currently proposed.",
    sections: nonEmpty,
    actionItems: ranked.map((task) => ({ title: task.title, priority: task.priority, dueAt: task.dueAt?.toISOString() ?? null, status: task.status })),
  };
}

export async function generateDailyBrief(userId: string, date = new Date()): Promise<DailyBrief> {
  const draft = await buildDailyBriefDraft(userId, date);
  const day = isoDate(date);
  await db.update(dailyBriefs).set({ status: "stale" }).where(and(eq(dailyBriefs.userId, userId), eq(dailyBriefs.briefDate, day)));
  const [row] = await db
    .insert(dailyBriefs)
    .values({
      userId,
      briefDate: day,
      status: "generated",
      summary: draft.summary,
      sections: draft.sections,
      actionItems: draft.actionItems,
    })
    .returning();
  if (!row) throw new Error("failed to generate daily brief");
  return row;
}

export async function getTodayBrief(userId: string, date = new Date()): Promise<DailyBrief | null> {
  const [row] = await db
    .select()
    .from(dailyBriefs)
    .where(and(eq(dailyBriefs.userId, userId), eq(dailyBriefs.briefDate, isoDate(date)), eq(dailyBriefs.status, "generated")))
    .orderBy(desc(dailyBriefs.generatedAt))
    .limit(1);
  return row ?? null;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function labelWithDue(title: string, dueAt: Date | null): string {
  return dueAt ? `${title} (due ${dueAt.toISOString().slice(0, 10)})` : title;
}
