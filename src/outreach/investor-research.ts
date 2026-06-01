import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { investorProfiles, investorSources, outreachCampaigns, researchQueries, researchSources, type InvestorProfile } from "../db/schema.js";
import { assertGovernorBudgetAvailable, GovernorBudgetExceededError, recordProviderUsage } from "../governor/budget.js";
import { createSearchProvider, researchProviderStatus } from "../research/provider.js";
import { ResearchProviderError, type SearchResult } from "../research/types.js";
import { classifySource, scoreSource } from "../research/verifier.js";
import { scoreInvestorFit } from "./investor-scoring.js";
import { investorSourceTypeForUrl, safeDomain, sourceConfidenceFromType } from "./source-policy.js";
import type { InvestorResearchInput } from "./types.js";

type ScoredInvestorSearchResult = SearchResult & { credibilityScore?: number | null };

export class OutreachProviderError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function researchInvestorsForCampaign(args: {
  userId: string;
  campaignId: string;
  input?: InvestorResearchInput;
}): Promise<{ investors: InvestorProfile[]; providerStatus: { selected: string; configured: boolean }; researchQueryId?: string; skipped?: string }> {
  const [campaign] = await db.select().from(outreachCampaigns).where(and(eq(outreachCampaigns.id, args.campaignId), eq(outreachCampaigns.userId, args.userId))).limit(1);
  if (!campaign) throw new Error("campaign_not_found");
  const providerStatus = args.input?.forceNoProvider ? { selected: "none", configured: false } : researchProviderStatus();
  if (!providerStatus.configured) {
    return { investors: [], providerStatus, skipped: "provider_not_configured" };
  }
  await assertGovernorBudgetAvailable(args.userId, "research");
  const query = buildInvestorQuery(campaign, args.input);
  const provider = createSearchProvider();
  try {
    const startedAt = Date.now();
    const results = await provider.search({ query, maxResults: args.input?.maxResults ?? 6 });
    await recordProviderUsage({ userId: args.userId, provider: provider.name, operation: "outreach.investor_search", latencyMs: Date.now() - startedAt, status: "completed" }).catch(() => null);
    const [researchQuery] = await db
      .insert(researchQueries)
      .values({
        userId: args.userId,
        sessionId: null,
        situationBriefId: null,
        query,
        normalizedQuery: query.toLowerCase().replace(/\s+/g, " ").trim(),
        intent: "investor_research",
        provider: provider.name,
        status: "completed",
        requiresFreshness: true,
        completedAt: new Date(),
      })
      .returning();
    const scored = results.map((result) => ({ ...result, sourceType: result.sourceType ?? classifySource(result.url), credibilityScore: scoreSource(result, "company_brief") }));
    if (researchQuery && scored.length > 0) {
      await db.insert(researchSources).values(
        scored.map((source) => ({
          queryId: researchQuery.id,
          url: source.url,
          title: source.title,
          sourceType: source.sourceType ?? "unknown",
          publishedAt: source.publishedAt ? new Date(source.publishedAt) : null,
          fetchedAt: new Date(),
          snippet: source.snippet ?? null,
          extractedText: null,
          credibilityScore: source.credibilityScore ?? null,
        })),
      );
    }
    const investors = await persistSourceBackedInvestors(args.userId, campaign.id, campaign, scored);
    await db.update(outreachCampaigns).set({ status: investors.length ? "ready_for_review" : "researching", updatedAt: new Date() }).where(eq(outreachCampaigns.id, campaign.id));
    return { investors, providerStatus: { selected: provider.name, configured: true }, researchQueryId: researchQuery?.id };
  } catch (err) {
    if (err instanceof GovernorBudgetExceededError) throw new OutreachProviderError("budget_exceeded", "Research daily request budget is exhausted.");
    if (err instanceof ResearchProviderError || /configured/i.test((err as Error).message)) {
      return { investors: [], providerStatus: { selected: providerStatus.selected, configured: false }, skipped: "provider_not_configured" };
    }
    throw err;
  }
}

export async function listCampaignInvestors(userId: string, campaignId: string): Promise<InvestorProfile[]> {
  return db.select().from(investorProfiles).where(and(eq(investorProfiles.userId, userId), eq(investorProfiles.campaignId, campaignId))).orderBy(desc(investorProfiles.fitScore), desc(investorProfiles.createdAt)).limit(100);
}

export async function updateInvestorStatus(userId: string, investorId: string, status: "shortlisted" | "dismissed"): Promise<InvestorProfile | null> {
  const [investor] = await db.update(investorProfiles).set({ status, updatedAt: new Date() }).where(and(eq(investorProfiles.id, investorId), eq(investorProfiles.userId, userId))).returning();
  return investor ?? null;
}

async function persistSourceBackedInvestors(userId: string, campaignId: string, campaign: typeof outreachCampaigns.$inferSelect, results: ScoredInvestorSearchResult[]): Promise<InvestorProfile[]> {
  const created: InvestorProfile[] = [];
  for (const result of results.slice(0, 8)) {
    if (!result.url || !result.title) continue;
    const sourceType = investorSourceTypeForUrl(result.url);
    const sourceConfidence = sourceConfidenceFromType(sourceType, result.credibilityScore);
    const firmName = inferFirmName(result);
    const preliminary = {
      firmName,
      stages: inferTags(result, [campaign.targetStage ?? ""]).filter(Boolean),
      sectors: inferTags(result, campaign.sectors),
      geographies: inferTags(result, [campaign.targetGeography ?? ""]).filter(Boolean),
      thesisSummary: truncate(result.snippet || result.title, 500),
      sourceConfidence,
      email: null,
    };
    const fit = scoreInvestorFit(preliminary, campaign);
    const [investor] = await db
      .insert(investorProfiles)
      .values({
        userId,
        campaignId,
        firmName,
        partnerName: null,
        roleTitle: null,
        websiteUrl: result.url,
        linkedinUrl: result.url.includes("linkedin.com") ? result.url : null,
        email: null,
        location: campaign.targetGeography,
        checkSize: null,
        stages: preliminary.stages,
        sectors: preliminary.sectors,
        geographies: preliminary.geographies,
        thesisSummary: preliminary.thesisSummary,
        sourceConfidence,
        fitScore: fit.fitScore,
        fitReasons: fit.fitReasons,
        riskFlags: fit.riskFlags,
        status: "discovered",
      })
      .returning();
    if (!investor) continue;
    await db.insert(investorSources).values({
      investorId: investor.id,
      userId,
      sourceType,
      title: result.title,
      url: result.url,
      snippet: result.snippet ?? null,
      credibilityScore: sourceConfidence,
      fetchedAt: new Date(),
    });
    created.push(investor);
  }
  return created;
}

function buildInvestorQuery(campaign: typeof outreachCampaigns.$inferSelect, input?: InvestorResearchInput): string {
  return [
    input?.geography ?? campaign.targetGeography,
    input?.sector ?? campaign.sectors.join(" "),
    input?.stage ?? campaign.targetStage,
    input?.targetInvestorType ?? "venture capital investors",
    input?.traction ? `traction ${input.traction}` : "",
    "fund thesis portfolio startup",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferFirmName(result: SearchResult): string {
  const title = result.title.replace(/\s*[|-]\s*(VC|Venture Capital|Crunchbase|LinkedIn|PitchBook).*$/i, "").trim();
  return title || safeDomain(result.url);
}

function inferTags(result: SearchResult, expected: string[]): string[] {
  const text = `${result.title} ${result.snippet ?? ""}`.toLowerCase();
  return expected.filter((tag) => tag && text.includes(tag.toLowerCase())).slice(0, 5);
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
