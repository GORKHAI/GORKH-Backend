import { researchInvestorsForCampaign } from "../../outreach/investor-research.js";
import { investorResearchInputSchema, type InvestorResearchInput } from "../../outreach/types.js";
import type { SubagentReport, SubagentTask } from "../types.js";

export async function runInvestorResearchSubagent(task: SubagentTask): Promise<SubagentReport> {
  const input = normalize(task.input);
  if (!input.campaignId) return failed(task, "Outreach campaign id is required.", "missing_campaign_id");
  if (!task.policy.allowResearch) return failed(task, "Investor research was denied by policy.", "research_not_allowed");
  const result = await researchInvestorsForCampaign({
    userId: task.userId,
    campaignId: input.campaignId,
    input: input.researchInput,
  });
  if (result.skipped) {
    return {
      taskId: task.id,
      kind: "investor_research",
      status: "failed",
      title: "Investor research unavailable",
      summary: "Research provider is not configured. No investor leads were fabricated.",
      findings: [],
      recommendedMainAgentMessage: "I can’t research investors yet because the research provider is not configured.",
      safetyNotes: ["No fake investors, partner names, emails, or citations were generated."],
      providerStatus: { provider: result.providerStatus.selected, configured: false, errorCode: result.skipped },
      createdAt: new Date().toISOString(),
    };
  }
  return {
    taskId: task.id,
    kind: "investor_research",
    status: "completed",
    title: "Investor research complete",
    summary: `Found ${result.investors.length} source-backed investor lead(s).`,
    findings: result.investors.map((investor) => ({
      claim: `${investor.firmName}: fit ${investor.fitScore ?? 0}.`,
      confidence: investor.sourceConfidence,
      citations: investor.websiteUrl ? [{ title: investor.firmName, url: investor.websiteUrl }] : [],
      limitation: investor.email ? undefined : "No source-backed direct email found.",
    })),
    recommendedMainAgentMessage: "Investor leads are ready for review on screen. No outreach was sent.",
    safetyNotes: ["Draft-only outreach. Human approval is required. External sending is disabled."],
    providerStatus: { provider: result.providerStatus.selected, configured: result.providerStatus.configured },
    researchQueryId: result.researchQueryId ?? null,
    sourceIds: [],
    citationQualityScore: result.investors.length ? Math.min(1, result.investors.reduce((sum, item) => sum + item.sourceConfidence, 0) / result.investors.length) : 0,
    provider: result.providerStatus.selected,
    query: input.researchInput?.startupSummary ?? null,
    generatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}

function failed(task: SubagentTask, summary: string, errorCode: string): SubagentReport {
  return {
    taskId: task.id,
    kind: "investor_research",
    status: "failed",
    title: "Investor research failed",
    summary,
    findings: [],
    safetyNotes: ["No outreach action was taken."],
    providerStatus: { provider: "none", configured: false, errorCode },
    createdAt: new Date().toISOString(),
  };
}

function normalize(input: unknown): { campaignId?: string; researchInput?: InvestorResearchInput } {
  const value = (input ?? {}) as Record<string, unknown>;
  const researchInput =
    typeof value.researchInput === "object" && value.researchInput
      ? investorResearchInputSchema.parse(value.researchInput)
      : undefined;
  return {
    campaignId: typeof value.campaignId === "string" ? value.campaignId : undefined,
    researchInput,
  };
}
