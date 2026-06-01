import { and, avg, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  actionProposals,
  investorProfiles,
  investorQualityReviews,
  investorSources,
  outreachCampaigns,
  outreachComplianceEvents,
  outreachDrafts,
  type InvestorProfile,
  type InvestorQualityReview,
  type OutreachDraft,
} from "../db/schema.js";
import { checkOutboundCompliance, recordOutreachComplianceEvent } from "./compliance.js";
import { normalizeWebsiteDomain } from "./lead-dedupe.js";

export interface DraftQualityReview {
  score: number;
  status: "passed" | "warning" | "failed";
  findings: string[];
  warnings: string[];
}

export async function reviewInvestorQuality(userId: string, investorId: string): Promise<InvestorQualityReview | null> {
  const [investor] = await db.select().from(investorProfiles).where(and(eq(investorProfiles.id, investorId), eq(investorProfiles.userId, userId))).limit(1);
  if (!investor) return null;
  const sources = await db.select().from(investorSources).where(and(eq(investorSources.userId, userId), eq(investorSources.investorId, investor.id)));
  const findings: string[] = [];
  const warnings: string[] = [];
  let score = 0;
  if (sources.length > 0) {
    score += 0.25;
    findings.push("Lead has at least one stored source URL.");
  } else warnings.push("missing_source_url");
  const officialish = sources.some((source) => ["website", "database"].includes(source.sourceType));
  if (officialish) {
    score += 0.15;
    findings.push("Lead has a higher-confidence source type.");
  } else warnings.push("source_type_low_confidence");
  const domain = normalizeWebsiteDomain(investor.websiteUrl);
  if (domain && sources.some((source) => normalizeWebsiteDomain(source.url) === domain)) {
    score += 0.15;
    findings.push("Source domain matches investor website domain.");
  } else if (domain) warnings.push("website_domain_not_supported_by_sources");
  if ((investor.sectors as string[]).length || (investor.stages as string[]).length || (investor.geographies as string[]).length) {
    score += 0.15;
    findings.push("Fit fields have source-derived support.");
  } else warnings.push("missing_stage_sector_geography_support");
  if (investor.emailStatus === "source_backed") {
    score += 0.15;
    findings.push("Email is source-backed.");
  } else warnings.push(investor.emailStatus === "generic_contact" ? "generic_contact_only" : "missing_source_backed_email");
  if ((investor.fitScore ?? 0) >= 0.6 && investor.sourceConfidence >= 0.5) {
    score += 0.15;
    findings.push("Fit and source confidence are adequate for review.");
  } else warnings.push("weak_fit_or_source_confidence");
  score = Math.max(0, Math.min(1, Number(score.toFixed(2))));
  const [review] = await db.insert(investorQualityReviews).values({ investorId: investor.id, userId, score, findings, warnings }).returning();
  await db.update(investorProfiles).set({ lastQualityReviewAt: new Date(), updatedAt: new Date() }).where(eq(investorProfiles.id, investor.id));
  return review ?? null;
}

export async function reviewDraftQuality(userId: string, draftId: string): Promise<DraftQualityReview | null> {
  const [draft] = await db.select().from(outreachDrafts).where(and(eq(outreachDrafts.id, draftId), eq(outreachDrafts.userId, userId))).limit(1);
  if (!draft) return null;
  const sourceIds = Array.isArray(draft.sourceIds) ? (draft.sourceIds as string[]) : [];
  const sources = sourceIds.length ? await db.select().from(investorSources).where(and(eq(investorSources.userId, userId), inArray(investorSources.id, sourceIds))) : [];
  const compliance = checkOutboundCompliance({
    subject: draft.subject,
    body: draft.body,
    hasSourceBackedPersonalization: sources.length > 0,
  });
  const findings = [...compliance.notes];
  const warnings = [...compliance.blockedReasons];
  let score = compliance.ok ? 0.45 : 0.1;
  if (draft.subject.length <= 80) {
    score += 0.15;
    findings.push("Subject is concise.");
  } else warnings.push("subject_too_long");
  if (sourceIds.length > 0 && sources.length === sourceIds.length) {
    score += 0.2;
    findings.push("All draft source IDs are valid.");
  } else warnings.push("invalid_or_missing_source_ids");
  if (draft.body.length <= 1400) {
    score += 0.1;
    findings.push("Draft is concise.");
  } else warnings.push("draft_too_long");
  if (!/urgent|guaranteed|as discussed|mutual friend/i.test(`${draft.subject} ${draft.body}`)) {
    score += 0.1;
    findings.push("No obvious spammy, false-urgency, or fake-relationship language.");
  } else warnings.push("spammy_or_unsupported_relationship_language");
  score = Math.max(0, Math.min(1, Number(score.toFixed(2))));
  const review = { score, status: warnings.length ? "warning" as const : "passed" as const, findings, warnings };
  await recordOutreachComplianceEvent({ userId, campaignId: draft.campaignId, draftId: draft.id, eventType: "draft_quality_review", payload: review });
  return review;
}

export async function latestDraftQualityReview(userId: string, draftId: string): Promise<DraftQualityReview | null> {
  const [row] = await db
    .select()
    .from(outreachComplianceEvents)
    .where(and(eq(outreachComplianceEvents.userId, userId), eq(outreachComplianceEvents.draftId, draftId), eq(outreachComplianceEvents.eventType, "draft_quality_review")))
    .orderBy(desc(outreachComplianceEvents.createdAt))
    .limit(1);
  return (row?.payload as DraftQualityReview | undefined) ?? null;
}

export async function campaignQualitySummary(userId: string, campaignId: string) {
  const [campaign] = await db.select().from(outreachCampaigns).where(and(eq(outreachCampaigns.id, campaignId), eq(outreachCampaigns.userId, userId))).limit(1);
  if (!campaign) return null;
  const [leadCountRow, shortlistedRow, duplicateRow, averagesRow, missingContactRow, strongPersonalizationRow, weakPersonalizationRow, draftsReviewRow, complianceWarningsRow] = await Promise.all([
    db.select({ value: count() }).from(investorProfiles).where(and(eq(investorProfiles.userId, userId), eq(investorProfiles.campaignId, campaignId))),
    db.select({ value: count() }).from(investorProfiles).where(and(eq(investorProfiles.userId, userId), eq(investorProfiles.campaignId, campaignId), eq(investorProfiles.status, "shortlisted"))),
    db.select({ value: count() }).from(investorProfiles).where(and(eq(investorProfiles.userId, userId), eq(investorProfiles.campaignId, campaignId), eq(investorProfiles.duplicateStatus, "candidate_duplicate"))),
    db.select({ fit: avg(investorProfiles.fitScore), source: avg(investorProfiles.sourceConfidence) }).from(investorProfiles).where(and(eq(investorProfiles.userId, userId), eq(investorProfiles.campaignId, campaignId))),
    db.select({ value: count() }).from(investorProfiles).where(and(eq(investorProfiles.userId, userId), eq(investorProfiles.campaignId, campaignId), inArray(investorProfiles.emailStatus, ["unknown", "unavailable", "generic_contact"]))),
    db.select({ value: count() }).from(outreachDrafts).where(and(eq(outreachDrafts.userId, userId), eq(outreachDrafts.campaignId, campaignId), sql`jsonb_array_length(${outreachDrafts.sourceIds}) > 0`)),
    db.select({ value: count() }).from(outreachDrafts).where(and(eq(outreachDrafts.userId, userId), eq(outreachDrafts.campaignId, campaignId), sql`jsonb_array_length(${outreachDrafts.sourceIds}) = 0`)),
    db.select({ value: count() }).from(outreachDrafts).where(and(eq(outreachDrafts.userId, userId), eq(outreachDrafts.campaignId, campaignId), inArray(outreachDrafts.status, ["draft", "proposed"]))),
    db.select({ value: count() }).from(outreachComplianceEvents).where(and(eq(outreachComplianceEvents.userId, userId), eq(outreachComplianceEvents.campaignId, campaignId))),
  ]);
  return {
    campaign,
    leadCount: leadCountRow[0]?.value ?? 0,
    shortlistedCount: shortlistedRow[0]?.value ?? 0,
    duplicateCandidates: duplicateRow[0]?.value ?? 0,
    averageFitScore: numberOrNull(averagesRow[0]?.fit),
    averageSourceConfidence: numberOrNull(averagesRow[0]?.source),
    missingContactCount: missingContactRow[0]?.value ?? 0,
    strongPersonalizationCount: strongPersonalizationRow[0]?.value ?? 0,
    weakPersonalizationCount: weakPersonalizationRow[0]?.value ?? 0,
    draftsNeedingReview: draftsReviewRow[0]?.value ?? 0,
    complianceWarnings: complianceWarningsRow[0]?.value ?? 0,
    recommendedNextActions: [
      "Review duplicate candidates before drafting at scale.",
      "Shortlist high-fit leads with source confidence above 0.5.",
      "Review every draft and action proposal manually.",
      "Do not send through GORKH v0; external sending remains disabled.",
    ],
  };
}

export async function campaignReviewPack(userId: string, campaignId: string) {
  const summary = await campaignQualitySummary(userId, campaignId);
  if (!summary) return null;
  const [investors, drafts, actions, compliance] = await Promise.all([
    db.select().from(investorProfiles).where(and(eq(investorProfiles.userId, userId), eq(investorProfiles.campaignId, campaignId))).orderBy(desc(investorProfiles.fitScore), desc(investorProfiles.createdAt)),
    db.select().from(outreachDrafts).where(and(eq(outreachDrafts.userId, userId), eq(outreachDrafts.campaignId, campaignId))).orderBy(desc(outreachDrafts.createdAt)),
    db.select().from(actionProposals).where(eq(actionProposals.userId, userId)).orderBy(desc(actionProposals.createdAt)).limit(100),
    db.select().from(outreachComplianceEvents).where(and(eq(outreachComplianceEvents.userId, userId), eq(outreachComplianceEvents.campaignId, campaignId))).orderBy(desc(outreachComplianceEvents.createdAt)),
  ]);
  const sources = investors.length
    ? await db.select().from(investorSources).where(and(eq(investorSources.userId, userId), inArray(investorSources.investorId, investors.map((investor) => investor.id))))
    : [];
  return {
    summary,
    investorLeads: investors.map((investor) => ({
      investor,
      sources: sources.filter((source) => source.investorId === investor.id),
      warnings: investor.riskFlags,
    })),
    draftEmails: drafts.map((draft: OutreachDraft) => ({
      draft,
      actionProposalId: draft.actionProposalId,
      actionProposal: actions.find((action) => action.id === draft.actionProposalId) ?? null,
      complianceNotes: draft.complianceNotes,
    })),
    compliance,
    warnings: [
      "Review pack is JSON only.",
      "No email has been sent.",
      "No form has been submitted.",
      "Missing emails are intentionally left blank.",
    ],
  };
}

function numberOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(3)) : null;
}
