import { generateStressSupport } from "../../stress/support.js";
import type { SubagentReport, SubagentTask } from "../types.js";

export async function runStressSupportSubagent(task: SubagentTask): Promise<SubagentReport> {
  const input = (task.input ?? {}) as { text?: string; liveMode?: boolean };
  const support = await generateStressSupport({
    userId: task.userId,
    sessionId: task.sessionId ?? null,
    text: input.text ?? "",
    allowTransientWithoutOptIn: true,
  });
  return {
    taskId: task.id,
    kind: "stress_support",
    status: "completed",
    title: support.supportType === "crisis_resource" ? "Crisis boundary support" : "Stress support",
    summary: support.content,
    findings: [{ claim: support.content, confidence: support.confidence }],
    recommendedMainAgentMessage: input.liveMode ? support.content.split(".")[0] + "." : support.content,
    safetyNotes: ["Support only. Not therapy, diagnosis, treatment, or emergency service."],
    createdAt: new Date().toISOString(),
  };
}
