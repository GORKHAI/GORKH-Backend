import type { Commitment, TaskItem, TaskPriority } from "../db/schema.js";

export function priorityForCommitment(commitment: Pick<Commitment, "dueAt" | "confidence" | "sensitivity">, now = new Date()): TaskPriority {
  const days = daysUntil(commitment.dueAt, now);
  if (days !== null && days <= 1) return "urgent";
  if (days !== null && days <= 3) return "high";
  if (commitment.sensitivity === "high" || commitment.confidence >= 0.85) return "high";
  if (commitment.sensitivity === "medium") return "normal";
  return "normal";
}

export function rankTasks<T extends { dueAt: Date | string | null; priority: TaskPriority; suggestedAt: Date | string; status: string }>(tasks: T[], now = new Date()): T[] {
  return [...tasks].sort((a, b) => scoreTask(b, now) - scoreTask(a, now));
}

function scoreTask(task: { dueAt: Date | string | null; priority: TaskPriority; suggestedAt: Date | string; status: string }, now: Date): number {
  const priorityScore = { urgent: 100, high: 75, normal: 45, low: 20 }[task.priority] ?? 40;
  const due = daysUntil(task.dueAt, now);
  const dueScore = due === null ? 0 : due < 0 ? 120 : Math.max(0, 80 - due * 12);
  const ageDays = Math.max(0, (now.getTime() - new Date(task.suggestedAt).getTime()) / 86_400_000);
  const statusScore = task.status === "accepted" || task.status === "scheduled" ? 12 : 0;
  return priorityScore + dueScore + Math.min(15, ageDays * 2) + statusScore;
}

function daysUntil(value: Date | string | null, now: Date): number | null {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - now.getTime()) / 86_400_000);
}
