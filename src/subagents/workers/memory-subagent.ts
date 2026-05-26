import { summarizeHumanContext } from "../../human/profile.js";
import type { SubagentReport, SubagentTask } from "../types.js";

export async function runMemorySubagent(task: SubagentTask): Promise<SubagentReport> {
  const summary = await summarizeHumanContext(task.userId);
  return {
    taskId: task.id,
    kind: "memory_lookup",
    status: "completed",
    title: "Memory/profile lookup",
    summary: "Loaded confirmed profile context as the safe v0 memory lookup surface.",
    findings: summary.confirmedFacts.slice(0, 8).map((fact) => ({ claim: `${fact.kind}: ${fact.content}`, confidence: fact.confidence })),
    recommendedMainAgentMessage: "Relevant confirmed context is ready.",
    safetyNotes: ["Sensitive/proposed facts are excluded by default."],
    createdAt: new Date().toISOString(),
  };
}
