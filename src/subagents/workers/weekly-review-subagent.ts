import { generateWeeklyReview } from "../../daily/weekly-review.js";
import type { SubagentReport, SubagentTask, SubagentWorkerContext } from "../types.js";

export async function runWeeklyReviewSubagent(task: SubagentTask, context: SubagentWorkerContext): Promise<SubagentReport> {
  await context.emitProgress("Generating weekly review...");
  const review = await generateWeeklyReview(task.userId);
  return {
    taskId: task.id,
    kind: task.kind,
    status: "completed",
    title: "Weekly review generated",
    summary: review.summary,
    findings: [{ claim: `Weekly review ${review.id} generated for week ${review.weekStartDate}.`, confidence: 1 }],
    recommendedMainAgentMessage: "Your weekly review is ready on screen.",
    safetyNotes: ["No therapy, diagnosis, or external action is included. Stress/load content requires opt-in."],
    createdAt: new Date().toISOString(),
  };
}
