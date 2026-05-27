import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { commitments, taskItems, type Commitment, type TaskItem, type TaskStatus } from "../db/schema.js";
import { priorityForCommitment, rankTasks as rankTaskRows } from "./priority-ranker.js";
import type { TaskProposal } from "./types.js";

export function proposeTaskFromCommitment(commitment: Commitment): TaskProposal {
  return {
    title: commitment.title,
    detail: commitment.detail ?? null,
    priority: priorityForCommitment(commitment),
    dueAt: commitment.dueAt,
    effortEstimate: effortForCommitment(commitment),
    context: contextForCommitment(commitment),
    blockedBy: commitment.owner && !["me", "we"].includes(commitment.owner) ? commitment.owner : null,
    nextStep: nextStepForCommitment(commitment),
  };
}

export async function createTaskFromCommitment(commitment: Commitment): Promise<TaskItem> {
  const proposal = proposeTaskFromCommitment(commitment);
  const [row] = await db
    .insert(taskItems)
    .values({
      userId: commitment.userId,
      sessionId: commitment.sessionId,
      commitmentId: commitment.id,
      title: proposal.title,
      detail: proposal.detail ?? null,
      priority: proposal.priority,
      status: "proposed",
      sourceType: "commitment",
      sourceId: commitment.id,
      dueAt: proposal.dueAt ?? null,
      effortEstimate: proposal.effortEstimate ?? null,
      context: proposal.context ?? null,
      blockedBy: proposal.blockedBy ?? null,
      nextStep: proposal.nextStep ?? null,
    })
    .returning();
  if (!row) throw new Error("failed to propose task");
  return row;
}

export async function proposeTasksForCommitments(values: Commitment[]): Promise<TaskItem[]> {
  const rows: TaskItem[] = [];
  for (const commitment of values) rows.push(await createTaskFromCommitment(commitment));
  return rows;
}

export async function listTaskInbox(userId: string): Promise<TaskItem[]> {
  const rows = await db
    .select()
    .from(taskItems)
    .where(and(eq(taskItems.userId, userId), inArray(taskItems.status, ["proposed", "accepted", "scheduled", "blocked", "waiting"])))
    .orderBy(desc(taskItems.suggestedAt));
  return rankTaskRows(rows);
}

export async function updateTaskStatus(userId: string, taskId: string, status: Extract<TaskStatus, "accepted" | "dismissed" | "done">): Promise<TaskItem | null> {
  const now = new Date();
  const [row] = await db
    .update(taskItems)
    .set({
      status,
      acceptedAt: status === "accepted" ? now : undefined,
      completedAt: status === "done" ? now : undefined,
      updatedAt: now,
    })
    .where(and(eq(taskItems.id, taskId), eq(taskItems.userId, userId)))
    .returning();
  return row ?? null;
}

export async function updateCommitmentStatus(userId: string, commitmentId: string, status: "confirmed" | "dismissed" | "done"): Promise<Commitment | null> {
  const [row] = await db
    .update(commitments)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(commitments.id, commitmentId), eq(commitments.userId, userId)))
    .returning();
  return row ?? null;
}

function effortForCommitment(commitment: Pick<Commitment, "title" | "detail">): string {
  const text = `${commitment.title} ${commitment.detail ?? ""}`;
  if (/\b(call|write|draft|prepare|review|collect|upload|send)\b/i.test(text)) return "15-30 min";
  return "5-15 min";
}

function contextForCommitment(commitment: Pick<Commitment, "counterparty" | "sensitivity">): string | null {
  if (commitment.counterparty) return `${commitment.counterparty} follow-up`;
  if (commitment.sensitivity !== "low") return `${commitment.sensitivity} sensitivity`;
  return null;
}

function nextStepForCommitment(commitment: Pick<Commitment, "title" | "counterparty" | "owner">): string {
  if (commitment.owner && !["me", "we"].includes(commitment.owner)) return `Check whether ${commitment.owner} has responded.`;
  if (commitment.counterparty) return `Confirm owner, deadline, and next step with ${commitment.counterparty}.`;
  return `Review and decide whether to accept: ${commitment.title}`;
}
