import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "../db/client.js";
import { commitments, followupSuggestions, taskItems, weeklyReviews, type WeeklyReview } from "../db/schema.js";
import { summarizeHumanContext } from "../human/profile.js";
import type { DailyBriefSection, WeeklyReviewDraft } from "./types.js";

export async function buildWeeklyReviewDraft(userId: string, date = new Date()): Promise<WeeklyReviewDraft> {
  const weekStart = startOfUtcWeek(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const [profile, completedTasks, openTasks, missedCommitments, followups] = await Promise.all([
    summarizeHumanContext(userId).catch(() => null),
    db.select().from(taskItems).where(and(eq(taskItems.userId, userId), eq(taskItems.status, "done"), gte(taskItems.updatedAt, weekStart), lt(taskItems.updatedAt, weekEnd))).orderBy(desc(taskItems.updatedAt)),
    db.select().from(taskItems).where(and(eq(taskItems.userId, userId), inArray(taskItems.status, ["proposed", "accepted", "scheduled", "blocked", "waiting"]))).orderBy(asc(taskItems.dueAt)),
    db.select().from(commitments).where(and(eq(commitments.userId, userId), inArray(commitments.status, ["proposed", "confirmed", "overdue"]), lt(commitments.dueAt, date))).orderBy(asc(commitments.dueAt)),
    db.select().from(followupSuggestions).where(and(eq(followupSuggestions.userId, userId), eq(followupSuggestions.status, "proposed"))).orderBy(desc(followupSuggestions.createdAt)),
  ]);
  const sections: DailyBriefSection[] = [
    { key: "completed_tasks", title: "Completed tasks", items: completedTasks.slice(0, 8).map((task) => task.title) },
    { key: "missed_commitments", title: "Missed commitments", items: missedCommitments.slice(0, 8).map((commitment) => labelWithDue(commitment.title, commitment.dueAt)) },
    { key: "open_loops", title: "Open loops", items: openTasks.slice(0, 8).map((task) => task.nextStep ? `${task.title} — ${task.nextStep}` : task.title) },
    { key: "followups", title: "Follow-ups", items: followups.slice(0, 6).map((followup) => followup.reason) },
    { key: "stressful_situations", title: "Stressful situations", items: profile?.stressSupportOptIn ? ["Review high-load moments only if you opted into stress support."] : ["Not included. Stress/load storage is off."] },
    { key: "top_wins", title: "Top wins", items: completedTasks.length > 0 ? completedTasks.slice(0, 3).map((task) => `Completed: ${task.title}`) : [] },
    { key: "risks", title: "Risks", items: missedCommitments.slice(0, 5).map((commitment) => `${commitment.title} needs review; do not treat this as final advice.`) },
    { key: "next_week_preparation", title: "Next week preparation", items: openTasks.slice(0, 5).map((task) => task.nextStep ?? `Review: ${task.title}`) },
    { key: "suggested_improvements", title: "Suggested improvements", items: ["Confirm proposed tasks you want to keep.", "Dismiss stale suggestions so future briefs rank better."] },
  ];
  const nonEmpty = sections.map((section) => ({ ...section, items: section.items.length > 0 ? section.items : ["None currently."] }));
  return {
    summary: `Weekly review: ${completedTasks.length} completed task(s), ${missedCommitments.length} missed commitment(s), ${openTasks.length} open loop(s).`,
    sections: nonEmpty,
    quality: {
      completedTaskCount: completedTasks.length,
      missedCommitmentCount: missedCommitments.length,
      openLoopCount: openTasks.length,
      confidence: Math.max(0.45, Math.min(0.95, 0.75 + completedTasks.length * 0.02 - missedCommitments.length * 0.03)),
    },
  };
}

export async function generateWeeklyReview(userId: string, date = new Date()): Promise<WeeklyReview> {
  const draft = await buildWeeklyReviewDraft(userId, date);
  const week = isoDate(startOfUtcWeek(date));
  await db.update(weeklyReviews).set({ status: "stale" }).where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.weekStartDate, week)));
  const [row] = await db
    .insert(weeklyReviews)
    .values({ userId, weekStartDate: week, status: "generated", summary: draft.summary, sections: draft.sections, quality: draft.quality })
    .returning();
  if (!row) throw new Error("failed to generate weekly review");
  return row;
}

export async function getLatestWeeklyReview(userId: string): Promise<WeeklyReview | null> {
  const [row] = await db.select().from(weeklyReviews).where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.status, "generated"))).orderBy(desc(weeklyReviews.generatedAt)).limit(1);
  return row ?? null;
}

function startOfUtcWeek(date: Date): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = result.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  result.setUTCDate(result.getUTCDate() + delta);
  return result;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function labelWithDue(title: string, dueAt: Date | null): string {
  return dueAt ? `${title} (due ${dueAt.toISOString().slice(0, 10)})` : title;
}
