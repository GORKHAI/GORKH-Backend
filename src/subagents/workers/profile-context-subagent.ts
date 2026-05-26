import { summarizeHumanContext } from "../../human/profile.js";
import type { SubagentReport, SubagentTask } from "../types.js";

export async function runProfileContextSubagent(task: SubagentTask): Promise<SubagentReport> {
  const input = (task.input ?? {}) as { includeProposedFacts?: boolean };
  const summary = await summarizeHumanContext(task.userId, { includeProposed: input.includeProposedFacts === true });
  const facts = input.includeProposedFacts ? [...summary.confirmedFacts, ...(summary.proposedFacts ?? [])] : summary.confirmedFacts;
  return {
    taskId: task.id,
    kind: "profile_context",
    status: "completed",
    title: "Profile context",
    summary: summary.occupation ? `Confirmed profile context loaded for ${summary.occupation}.` : "Confirmed profile context loaded.",
    findings: facts.slice(0, 8).map((fact) => ({ claim: `${fact.kind}: ${fact.content}`, confidence: fact.confidence })),
    recommendedMainAgentMessage: "Profile context is available for the main agent.",
    safetyNotes: ["Confirmed facts only by default. Proposed facts must be labeled if used."],
    createdAt: new Date().toISOString(),
  };
}
