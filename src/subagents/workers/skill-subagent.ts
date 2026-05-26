import { matchEnabledSkillsForSituation } from "../../skills/registry.js";
import type { SubagentReport, SubagentTask } from "../types.js";

export async function runSkillSubagent(task: SubagentTask): Promise<SubagentReport> {
  const input = (task.input ?? {}) as { situationDescription?: string; internalType?: string };
  const query = `${input.internalType ?? ""} ${input.situationDescription ?? ""}`.trim();
  const skills = await matchEnabledSkillsForSituation(task.userId, query);
  return {
    taskId: task.id,
    kind: "skill_matcher",
    status: "completed",
    title: "Skill match",
    summary: skills.length > 0 ? `Matched ${skills.length} enabled skill(s).` : "No enabled skills matched.",
    findings: skills.map((skill) => ({ claim: `${skill.name}: ${skill.description}`, confidence: 0.8 })),
    recommendedMainAgentMessage: skills.length > 0 ? "A relevant enabled workflow is available." : "No enabled workflow matched yet.",
    safetyNotes: ["Skills are declarative workflows and are not executed automatically."],
    createdAt: new Date().toISOString(),
  };
}
