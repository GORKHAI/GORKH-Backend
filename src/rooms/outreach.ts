import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { investorProfiles, outreachCampaigns, rooms } from "../db/schema.js";
import { createRoom } from "./room-service.js";

export async function createRoomForInvestor(userId: string, investorId: string) {
  const [investor] = await db.select().from(investorProfiles).where(and(eq(investorProfiles.id, investorId), eq(investorProfiles.userId, userId))).limit(1);
  if (!investor) return null;
  const campaign = investor.campaignId
    ? (await db.select().from(outreachCampaigns).where(and(eq(outreachCampaigns.id, investor.campaignId), eq(outreachCampaigns.userId, userId))).limit(1))[0]
    : null;
  const room = await createRoom(userId, {
    outreachCampaignId: investor.campaignId,
    investorId: investor.id,
    title: `${investor.firmName} investor call`,
    transcriptionEnabled: true,
    recordingEnabled: false,
    aiAgentEnabled: false,
  });
  return { room, investor, campaign: campaign ?? null };
}

export async function roomsForInvestor(userId: string, investorId: string) {
  const [investor] = await db.select({ id: investorProfiles.id }).from(investorProfiles).where(and(eq(investorProfiles.id, investorId), eq(investorProfiles.userId, userId))).limit(1);
  if (!investor) return null;
  return db.select().from(rooms).where(and(eq(rooms.investorId, investorId), eq(rooms.userId, userId))).orderBy(desc(rooms.createdAt));
}
