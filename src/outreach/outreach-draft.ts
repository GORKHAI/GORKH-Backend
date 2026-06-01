import { and, desc, eq, inArray } from "drizzle-orm";
import { createActionProposal } from "../actions/proposal.js";
import { db } from "../db/client.js";
import { investorProfiles, investorSources, outreachDrafts, type OutreachDraft } from "../db/schema.js";
import { checkOutboundCompliance, recordOutreachComplianceEvent } from "./compliance.js";
import type { DraftEmailsInput } from "./types.js";

export async function draftOutreachEmails(args: {
  userId: string;
  campaignId: string;
  input: DraftEmailsInput;
}): Promise<OutreachDraft[]> {
  const investors = await db
    .select()
    .from(investorProfiles)
    .where(
      and(
        eq(investorProfiles.userId, args.userId),
        eq(investorProfiles.campaignId, args.campaignId),
        args.input.investorIds?.length ? inArray(investorProfiles.id, args.input.investorIds) : inArray(investorProfiles.status, ["discovered", "shortlisted"]),
      ),
    )
    .orderBy(desc(investorProfiles.fitScore), desc(investorProfiles.createdAt))
    .limit(20);
  const drafts: OutreachDraft[] = [];
  for (const investor of investors) {
    const sources = await db.select().from(investorSources).where(and(eq(investorSources.userId, args.userId), eq(investorSources.investorId, investor.id))).orderBy(desc(investorSources.createdAt)).limit(5);
    if (sources.length === 0) continue;
    const strongPersonalization = investor.sourceConfidence >= 0.5 && (investor.fitScore ?? 0) >= 0.55 && investor.fitReasons.length > 0;
    const personalization = strongPersonalization
      ? [`Personalization confidence: ${Math.round(investor.sourceConfidence * 100)}%.`, ...investor.fitReasons.slice(0, 3)]
      : [
          "Personalization confidence: low.",
          `I found public source context for ${investor.firmName}, but the fit should be reviewed manually before sending elsewhere.`,
        ];
    const subject = `Nearmind / GORKH intro for ${investor.firmName}`;
    const body = buildDraftBody({
      senderIdentity: args.input.senderIdentity,
      firmName: investor.firmName,
      startupSummary: String((await getCampaignSummary(args.campaignId)) ?? "Nearmind/GORKH is a real-time adaptive AI assistant."),
      ask: args.input.ask,
      personalization,
      strongPersonalization,
    });
    const compliance = checkOutboundCompliance({ subject, body, hasSourceBackedPersonalization: sources.length > 0 });
    const [draft] = await db
      .insert(outreachDrafts)
      .values({
        userId: args.userId,
        campaignId: args.campaignId,
        investorId: investor.id,
        subject,
        body,
        personalizationNotes: personalization,
        sourceIds: sources.map((source) => source.id),
        complianceNotes: [
          ...compliance.notes,
          ...compliance.blockedReasons,
          strongPersonalization ? "Source-backed personalization is available." : "Weak personalization: keep draft generic and review manually.",
          ...(investor.riskFlags as string[]),
        ],
        status: compliance.ok ? "proposed" : "draft",
      })
      .returning();
    if (!draft) continue;
    await recordOutreachComplianceEvent({
      userId: args.userId,
      campaignId: args.campaignId,
      draftId: draft.id,
      eventType: "outbound_compliance_check",
      payload: compliance,
    });
    drafts.push(draft);
  }
  return drafts;
}

export async function listOutreachDrafts(userId: string, campaignId: string): Promise<OutreachDraft[]> {
  return db.select().from(outreachDrafts).where(and(eq(outreachDrafts.userId, userId), eq(outreachDrafts.campaignId, campaignId))).orderBy(desc(outreachDrafts.createdAt)).limit(100);
}

export async function getOwnedOutreachDraft(userId: string, draftId: string): Promise<OutreachDraft | null> {
  const [draft] = await db.select().from(outreachDrafts).where(and(eq(outreachDrafts.userId, userId), eq(outreachDrafts.id, draftId))).limit(1);
  return draft ?? null;
}

export async function createActionProposalForDraft(userId: string, draftId: string): Promise<{ draft: OutreachDraft; proposal: unknown } | null> {
  const draft = await getOwnedOutreachDraft(userId, draftId);
  if (!draft) return null;
  const proposal = await createActionProposal(userId, {
    sourceType: "manual",
    actionType: "outbound_email_review",
    title: draft.subject,
    description: "Review investor outreach draft. GORKH will not send this email.",
    payload: {
      draftId: draft.id,
      campaignId: draft.campaignId,
      investorId: draft.investorId,
      subject: draft.subject,
      body: draft.body,
      sendDisabled: true,
      hiddenTrackingDisabled: true,
    },
  });
  const [updated] = await db.update(outreachDrafts).set({ actionProposalId: proposal.id, updatedAt: new Date() }).where(eq(outreachDrafts.id, draft.id)).returning();
  return { draft: updated ?? draft, proposal };
}

export async function updateOutreachDraftStatus(userId: string, draftId: string, status: "approved" | "rejected"): Promise<OutreachDraft | null> {
  const [draft] = await db.update(outreachDrafts).set({ status, updatedAt: new Date() }).where(and(eq(outreachDrafts.id, draftId), eq(outreachDrafts.userId, userId))).returning();
  return draft ?? null;
}

async function getCampaignSummary(campaignId: string): Promise<string | null> {
  const { outreachCampaigns } = await import("../db/schema.js");
  const [campaign] = await db.select({ startupSummary: outreachCampaigns.startupSummary }).from(outreachCampaigns).where(eq(outreachCampaigns.id, campaignId)).limit(1);
  return campaign?.startupSummary ?? null;
}

function buildDraftBody(input: { senderIdentity: string; firmName: string; startupSummary: string; ask: string; personalization: string[]; strongPersonalization: boolean }): string {
  const reason = input.strongPersonalization
    ? input.personalization.find((item) => !item.startsWith("Personalization confidence")) ?? "your published focus appears relevant"
    : "I found some public context suggesting this may be relevant, but I would verify fit before assuming it is a match";
  return [
    `Hi ${input.firmName} team,`,
    "",
    `I’m ${input.senderIdentity}. ${input.startupSummary}`,
    "",
    `I’m reaching out because ${reason}`,
    "",
    `${input.ask} I can share a short deck if useful.`,
    "",
    "If this is not relevant, feel free to opt out and I will not follow up.",
    "",
    "Best,",
    input.senderIdentity,
  ].join("\n");
}
