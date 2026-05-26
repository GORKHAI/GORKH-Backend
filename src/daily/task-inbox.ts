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
    .where(and(eq(taskItems.userId, userId), inArray(taskItems.status, ["proposed", "accepted", "scheduled"])))
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
