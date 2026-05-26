import { db } from "../../db/client.js";
import { commitments } from "../../db/schema.js";
import { extractCommitmentsFromText } from "../../daily/commitment-extractor.js";
import { proposeTasksForCommitments } from "../../daily/task-inbox.js";
import type { SubagentReport, SubagentTask, SubagentWorkerContext } from "../types.js";

export async function runCommitmentSubagent(task: SubagentTask, context: SubagentWorkerContext): Promise<SubagentReport> {
  const input = task.input as { text?: string; internalType?: string; sourceType?: "transcript" | "user_text" | "subagent_report" };
  const text = input.text ?? "";
  await context.emitProgress("Extracting proposed commitments...");
  const proposed = extractCommitmentsFromText({
    text,
    sourceType: input.sourceType ?? "user_text",
    sourceId: task.parentTurnId ?? task.id,
    internalType: input.internalType ?? null,
  });
  if (proposed.length === 0) {
    return emptyReport(task, "No explicit commitments detected.");
  }
  const rows = await db
    .insert(commitments)
    .values(
      proposed.map((item) => ({
        userId: task.userId,
        sessionId: task.sessionId ?? null,
        sourceType: item.sourceType,
        sourceId: item.sourceId ?? null,
        owner: item.owner ?? null,
        counterparty: item.counterparty ?? null,
        title: item.title,
        detail: item.detail ?? null,
        dueAt: item.dueAt ?? null,
        status: "proposed" as const,
        confidence: item.confidence,
        sensitivity: item.sensitivity,
      })),
    )
    .returning();
  await proposeTasksForCommitments(rows);
  return {
    taskId: task.id,
    kind: task.kind,
    status: "completed",
    title: "Commitments proposed",
    summary: `Proposed ${rows.length} commitment${rows.length === 1 ? "" : "s"} and matching task inbox item${rows.length === 1 ? "" : "s"}.`,
    findings: rows.map((row) => ({ claim: row.title, confidence: row.confidence, limitation: "Requires user confirmation before becoming active." })),
    recommendedMainAgentMessage: "I found possible commitments and placed them in your review inbox.",
    safetyNotes: ["Commitments are proposed only; none were confirmed automatically."],
    createdAt: new Date().toISOString(),
  };
}

function emptyReport(task: SubagentTask, summary: string): SubagentReport {
  return {
    taskId: task.id,
    kind: task.kind,
    status: "completed",
    title: "No commitments proposed",
    summary,
    findings: [],
    recommendedMainAgentMessage: summary,
    safetyNotes: ["No commitments were fabricated."],
    createdAt: new Date().toISOString(),
  };
}
