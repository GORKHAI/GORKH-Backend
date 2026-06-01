import type { InvestorProfile, OutreachCampaign } from "../db/schema.js";
import type { InvestorFitResult } from "./types.js";

export function scoreInvestorFit(investor: Pick<InvestorProfile, "firmName" | "stages" | "sectors" | "geographies" | "thesisSummary" | "sourceConfidence" | "email">, campaign: Pick<OutreachCampaign, "startupSummary" | "targetStage" | "targetGeography" | "sectors" | "raiseTarget">): InvestorFitResult {
  const reasons: string[] = [];
  const riskFlags: string[] = [];
  let score = 0.15;

  const investorText = `${investor.firmName} ${investor.thesisSummary ?? ""} ${investor.sectors.join(" ")} ${investor.geographies.join(" ")} ${investor.stages.join(" ")}`.toLowerCase();
  const startupText = `${campaign.startupSummary} ${campaign.sectors.join(" ")} ${campaign.targetGeography ?? ""} ${campaign.targetStage ?? ""}`.toLowerCase();

  for (const sector of campaign.sectors) {
    if (sector && investorText.includes(sector.toLowerCase())) {
      score += 0.18;
      reasons.push(`Source text mentions sector match: ${sector}.`);
    }
  }
  for (const token of ["fintech", "payments", "remittance", "stablecoin", "ai", "voice", "africa", "morocco", "mobile"]) {
    if (startupText.includes(token) && investorText.includes(token)) {
      score += 0.08;
      reasons.push(`Shared keyword appears in sourced material: ${token}.`);
    }
  }
  if (campaign.targetStage && investorText.includes(campaign.targetStage.toLowerCase())) {
    score += 0.14;
    reasons.push(`Stage appears aligned: ${campaign.targetStage}.`);
  }
  if (campaign.targetGeography && investorText.includes(campaign.targetGeography.toLowerCase())) {
    score += 0.14;
    reasons.push(`Geography appears aligned: ${campaign.targetGeography}.`);
  }
  if (!investor.email) riskFlags.push("No source-backed direct email found; keep outreach draft-only.");
  if ((investor.sourceConfidence ?? 0.5) < 0.45) riskFlags.push("Low source confidence; verify manually before outreach.");

  score += Math.min(0.2, Math.max(0, investor.sourceConfidence ?? 0.5) * 0.2);
  return {
    fitScore: Math.max(0, Math.min(1, Number(score.toFixed(2)))),
    fitReasons: reasons.length ? reasons.slice(0, 6) : ["Source-backed investor mention found; fit requires manual review."],
    riskFlags,
    confidence: Math.max(0.2, Math.min(0.9, investor.sourceConfidence ?? 0.5)),
  };
}
