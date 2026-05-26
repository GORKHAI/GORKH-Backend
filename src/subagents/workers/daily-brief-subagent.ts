import { generateDailyBrief } from "../../daily/daily-brief.js";
import type { SubagentReport, SubagentTask, SubagentWorkerContext } from "../types.js";

export async function runDailyBriefSubagent(task: SubagentTask, context: SubagentWorkerContext): Promise<SubagentReport> {
  await context.emitProgress("Generating daily brief...");
  const brief = await generateDailyBrief(task.userId);
  return {
    taskId: task.id,
    kind: task.kind,
    status: "completed",
    title: "Daily brief generated",
    summary: brief.summary,
    findings: [{ claim: `Daily brief ${brief.id} generated for ${brief.briefDate}.`, confidence: 1 }],
    recommendedMainAgentMessage: "Your daily brief is ready on screen.",
    safetyNotes: ["The daily brief uses stored profile-safe facts and proposed tasks are labeled as proposed."],
    createdAt: new Date().toISOString(),
  };
}
