import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { outreachCampaigns, type OutreachCampaign } from "../db/schema.js";
import type { CreateOutreachCampaignInput } from "./types.js";

export async function createOutreachCampaign(userId: string, input: CreateOutreachCampaignInput): Promise<OutreachCampaign> {
  const [campaign] = await db
    .insert(outreachCampaigns)
    .values({
      userId,
      name: input.name,
      startupSummary: input.startupSummary,
      raiseTarget: input.raiseTarget ?? null,
      targetStage: input.targetStage ?? null,
      targetGeography: input.targetGeography ?? null,
      sectors: input.sectors,
      status: "draft",
      complianceBasis: input.complianceBasis ?? "User-requested investor research and draft-only outreach review.",
    })
    .returning();
  if (!campaign) throw new Error("failed to create outreach campaign");
  return campaign;
}

export function listOutreachCampaigns(userId: string): Promise<OutreachCampaign[]> {
  return db.select().from(outreachCampaigns).where(eq(outreachCampaigns.userId, userId)).orderBy(desc(outreachCampaigns.createdAt)).limit(100);
}

export async function getOwnedOutreachCampaign(userId: string, campaignId: string): Promise<OutreachCampaign | null> {
  const [campaign] = await db.select().from(outreachCampaigns).where(and(eq(outreachCampaigns.id, campaignId), eq(outreachCampaigns.userId, userId))).limit(1);
  return campaign ?? null;
}
