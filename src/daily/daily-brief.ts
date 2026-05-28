import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { actionProposals, commitments, connectorAccounts, connectorItems, dailyBriefFeedback, dailyBriefs, followupSuggestions, situationBriefs, taskItems, type DailyBrief } from "../db/schema.js";
import { summarizeHumanContext } from "../human/profile.js";
import { explainTaskRanking, rankTasks } from "./priority-ranker.js";
import type { DailyBriefDraft, DailyBriefQuality, DailyBriefSection } from "./types.js";

export async function buildDailyBriefDraft(userId: string, date = new Date()): Promise<DailyBriefDraft> {
  const todayStart = startOfUtcDay(date);
  const [profile, tasks, openCommitments, followups, situations, connectorEvents, actions, feedback] = await Promise.all([
    summarizeHumanContext(userId).catch(() => null),
    db.select().from(taskItems).where(and(eq(taskItems.userId, userId), inArray(taskItems.status, ["proposed", "accepted", "scheduled", "blocked", "waiting"]))).orderBy(desc(taskItems.suggestedAt)),
    db.select().from(commitments).where(and(eq(commitments.userId, userId), inArray(commitments.status, ["proposed", "confirmed", "overdue"]))).orderBy(asc(commitments.dueAt)),
    db.select().from(followupSuggestions).where(and(eq(followupSuggestions.userId, userId), eq(followupSuggestions.status, "proposed"))).orderBy(desc(followupSuggestions.createdAt)),
    db.select().from(situationBriefs).where(and(eq(situationBriefs.userId, userId), gte(situationBriefs.scheduledAt, todayStart))).orderBy(asc(situationBriefs.scheduledAt)).limit(5),
    db
      .select({
        title: connectorItems.title,
        startsAt: connectorItems.startsAt,
        provider: connectorItems.provider,
      })
      .from(connectorItems)
      .innerJoin(connectorAccounts, eq(connectorAccounts.id, connectorItems.connectorAccountId))
      .where(
        and(
          eq(connectorItems.userId, userId),
          eq(connectorItems.itemType, "calendar_event"),
          gte(connectorItems.startsAt, todayStart),
          eq(connectorAccounts.status, "connected"),
        ),
      )
      .orderBy(asc(connectorItems.startsAt))
      .limit(5),
    db.select().from(actionProposals).where(and(eq(actionProposals.userId, userId), eq(actionProposals.status, "proposed"))).orderBy(desc(actionProposals.createdAt)).limit(5),
    db.select().from(dailyBriefFeedback).where(eq(dailyBriefFeedback.userId, userId)).orderBy(desc(dailyBriefFeedback.createdAt)).limit(50),
  ]);
  const ranked = rankTasks(tasks).slice(0, 8);
  const topThree = ranked.slice(0, 3);
  const timeSensitive = openCommitments.filter((commitment) => isDueSoon(commitment.dueAt, date)).slice(0, 5);
  const waiting = [
    ...openCommitments.filter((c) => c.owner && !["me", "we"].includes(c.owner)),
    ...ranked.filter((task) => task.status === "waiting" || task.status === "blocked" || task.blockedBy),
  ].slice(0, 5);
  const lowEffort = ranked.filter((task) => task.effortEstimate?.includes("5-15") || task.priority === "low").slice(0, 5);
  const deepWork = ranked.filter((task) => task.effortEstimate?.includes("30") || task.priority === "high").slice(0, 5);
  const quality = scoreDailyBrief({ ranked, openCommitments, feedback, date });
  const sections: DailyBriefSection[] = [
    { key: "top_priorities", title: "Top 3 priorities", items: topThree.map((task) => `${labelWithDue(task.title, task.dueAt)} — ${task.nextStep ?? "review next step"}`) },
    { key: "time_sensitive_commitments", title: "Time-sensitive commitments", items: timeSensitive.map((commitment) => labelWithDue(commitment.title, commitment.dueAt)) },
    { key: "followups_due", title: "Follow-ups due", items: followups.slice(0, 5).map((followup) => labelWithDue(followup.reason, followup.dueAt)) },
    {
      key: "upcoming_situations",
      title: "Meetings/situations to prepare for",
      items: [
        ...situations.map((situation) => `${situation.description}${situation.scheduledAt ? ` (${situation.scheduledAt.toISOString()})` : ""}`),
        ...connectorEvents.map((event) => `${event.title ?? "Calendar event"}${event.startsAt ? ` (${event.startsAt.toISOString()})` : ""}${event.provider === "google_calendar" ? " [google_calendar]" : ""}`),
      ],
    },
    { key: "waiting_on_others", title: "Waiting on others", items: waiting.map((item) => item.title) },
    { key: "risk_items", title: "Risk items", items: openCommitments.filter((c) => c.sensitivity !== "low").slice(0, 5).map((c) => `${c.title} (${c.sensitivity}; review, do not treat as final advice)`) },
    { key: "low_effort_admin", title: "Low-effort admin tasks", items: lowEffort.map((task) => task.title) },
    { key: "deep_work", title: "Deep-work tasks", items: deepWork.map((task) => task.title) },
    { key: "stress_load", title: "Stress/load note", items: profile?.stressSupportOptIn ? ["Keep the day plan short and leave buffer before high-stakes situations."] : [] },
    { key: "suggested_next_action", title: "Suggested next action", items: topThree.slice(0, 1).map((task) => task.nextStep ?? `Review and accept: ${task.title}`) },
    { key: "research_watch", title: "Research/watch items", items: [] },
    { key: "action_approvals", title: "Action proposals needing approval", items: actions.map((action) => `${action.title} (${action.riskLevel})`) },
  ];
  const nonEmpty = sections.map((section) => ({ ...section, items: section.items.length > 0 ? section.items : ["None currently."] }));
  return {
    summary: ranked.length > 0 ? `Top priority: ${ranked[0]?.title}. You have ${ranked.length} open task candidates and ${openCommitments.length} open commitments.` : "No urgent daily-life items are currently proposed.",
    sections: nonEmpty,
    actionItems: ranked.map((task) => ({
      title: task.title,
      priority: task.priority,
      dueAt: task.dueAt?.toISOString() ?? null,
      status: task.status,
      nextStep: task.nextStep ?? null,
      effortEstimate: task.effortEstimate ?? null,
      ranking: explainTaskRanking(task, date),
    })),
    quality,
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
      sections: { items: draft.sections, quality: draft.quality },
      actionItems: draft.actionItems,
    })
    .returning();
  if (!row) throw new Error("failed to generate daily brief");
  return row;
}

export async function recordDailyBriefFeedback(args: { userId: string; briefId: string; sectionKey: string; rating?: number | null; feedback?: string | null; action?: string | null }) {
  const [brief] = await db.select({ id: dailyBriefs.id }).from(dailyBriefs).where(and(eq(dailyBriefs.id, args.briefId), eq(dailyBriefs.userId, args.userId))).limit(1);
  if (!brief) return null;
  const [row] = await db
    .insert(dailyBriefFeedback)
    .values({
      userId: args.userId,
      briefId: args.briefId,
      sectionKey: args.sectionKey,
      rating: args.rating ?? null,
      feedback: args.feedback ?? null,
      action: args.action ?? null,
    })
    .returning();
  return row ?? null;
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

function isDueSoon(dueAt: Date | null, now: Date): boolean {
  if (!dueAt) return false;
  const days = Math.ceil((dueAt.getTime() - now.getTime()) / 86_400_000);
  return days <= 7;
}

function scoreDailyBrief(args: {
  ranked: Array<{ dueAt: Date | null; status: string }>;
  openCommitments: Array<{ dueAt: Date | null; status: string }>;
  feedback: Array<{ rating: number | null; action: string | null }>;
  date: Date;
}): DailyBriefQuality {
  const staleItemCount = args.ranked.filter((task) => task.dueAt && task.dueAt.getTime() < args.date.getTime() && task.status !== "done").length;
  const overdueItemCount = args.openCommitments.filter((commitment) => commitment.dueAt && commitment.dueAt.getTime() < args.date.getTime()).length;
  const accepted = args.feedback.filter((item) => item.action === "accepted" || (item.rating ?? 0) >= 4).length;
  const dismissed = args.feedback.filter((item) => item.action === "dismissed" || (item.rating ?? 0) <= 2).length;
  const totalFeedback = Math.max(1, accepted + dismissed);
  const briefRelevanceScore = Math.max(0.2, Math.min(1, 0.9 - staleItemCount * 0.08 - overdueItemCount * 0.05 + accepted * 0.02 - dismissed * 0.04));
  return {
    briefRelevanceScore,
    staleItemCount,
    overdueItemCount,
    acceptedSuggestionRate: accepted / totalFeedback,
    dismissedSuggestionRate: dismissed / totalFeedback,
    confidence: Math.max(0.4, Math.min(0.95, briefRelevanceScore - (args.ranked.length === 0 ? 0.1 : 0))),
  };
}
