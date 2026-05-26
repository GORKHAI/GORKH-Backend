import { proposeFollowup } from "../../daily/followup-detector.js";
import type { SubagentReport, SubagentTask, SubagentWorkerContext } from "../types.js";

export async function runFollowupSubagent(task: SubagentTask, context: SubagentWorkerContext): Promise<SubagentReport> {
  const input = task.input as { text?: string };
  await context.emitProgress("Checking follow-up need...");
  const followup = await proposeFollowup({ userId: task.userId, sessionId: task.sessionId ?? null, text: input.text ?? "" });
  if (!followup) {
    return {
      taskId: task.id,
      kind: task.kind,
      status: "completed",
      title: "No follow-up proposed",
      summary: "No explicit follow-up signal was detected.",
      findings: [],
      recommendedMainAgentMessage: "I did not find a clear follow-up to propose.",
      safetyNotes: ["No follow-up message was fabricated."],
      createdAt: new Date().toISOString(),
    };
  }
  return {
    taskId: task.id,
    kind: task.kind,
    status: "completed",
    title: "Follow-up proposed",
    summary: followup.reason,
    findings: [{ claim: followup.reason, confidence: 0.76 }],
    recommendedMainAgentMessage: "I proposed a follow-up draft for review.",
    safetyNotes: ["The message is a draft only and will not be sent automatically."],
    createdAt: new Date().toISOString(),
  };
}
