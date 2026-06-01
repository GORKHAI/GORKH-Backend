import { listCampaignInvestors } from "../../outreach/investor-research.js";
import type { SubagentReport, SubagentTask, SubagentWorkerContext } from "../types.js";

export async function runInvestorScoringSubagent(task: SubagentTask, context: SubagentWorkerContext): Promise<SubagentReport> {
  const input = normalizeInput(task.input);
  if (!input.campaignId) return failed(task, "Missing outreach campaign id.");
  await context.emitProgress("Loading source-backed investor scores.");
  const investors = await listCampaignInvestors(task.userId, input.campaignId);
  return {
    taskId: task.id,
    kind: task.kind,
    status: "completed",
    title: "Investor scoring complete",
    summary: investors.length ? `Reviewed ${investors.length} source-backed investor lead(s).` : "No investor leads are available to score yet.",
    findings: investors.slice(0, 10).map((investor) => ({
      claim: `${investor.firmName}: fit score ${investor.fitScore ?? "not scored"}. ${(investor.fitReasons as string[]).join(" ")}`,
      confidence: investor.sourceConfidence,
      limitation: investor.riskFlags.length ? (investor.riskFlags as string[]).join("; ") : undefined,
    })),
    recommendedMainAgentMessage: "Investor scores are ready for review on screen.",
    safetyNotes: ["Scores are ranking aids only.", "No outreach was sent."],
    createdAt: new Date().toISOString(),
  };
}

function failed(task: SubagentTask, summary: string): SubagentReport {
  return {
    taskId: task.id,
    kind: task.kind,
    status: "failed",
    title: "Investor scoring unavailable",
    summary,
    findings: [],
    recommendedMainAgentMessage: summary,
    safetyNotes: ["No outreach was sent."],
    createdAt: new Date().toISOString(),
  };
}

function normalizeInput(input: unknown): { campaignId?: string } {
  if (!input || typeof input !== "object") return {};
  const value = input as Record<string, unknown>;
  return { campaignId: typeof value.campaignId === "string" ? value.campaignId : undefined };
}
