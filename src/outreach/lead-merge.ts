import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { investorProfiles, investorSources, type InvestorProfile } from "../db/schema.js";
import { isDuplicateCandidate } from "./lead-dedupe.js";

export async function mergeInvestorLeads(userId: string, duplicateId: string, targetId: string): Promise<{ target: InvestorProfile; merged: InvestorProfile } | null> {
  if (duplicateId === targetId) return null;
  const [target, duplicate] = await Promise.all([getInvestor(userId, targetId), getInvestor(userId, duplicateId)]);
  if (!target || !duplicate || target.campaignId !== duplicate.campaignId) return null;
  if (duplicate.duplicateStatus !== "candidate_duplicate" && !isDuplicateCandidate(target, duplicate)) return null;
  const mergedReasons = unique([...(target.fitReasons as string[]), ...(duplicate.fitReasons as string[])]);
  const mergedFlags = unique([...(target.riskFlags as string[]), ...(duplicate.riskFlags as string[])]);
  const mergedSectors = unique([...(target.sectors as string[]), ...(duplicate.sectors as string[])]);
  const mergedStages = unique([...(target.stages as string[]), ...(duplicate.stages as string[])]);
  const mergedGeos = unique([...(target.geographies as string[]), ...(duplicate.geographies as string[])]);
  await db.update(investorSources).set({ investorId: target.id }).where(and(eq(investorSources.userId, userId), eq(investorSources.investorId, duplicate.id)));
  const [updatedTarget] = await db
    .update(investorProfiles)
    .set({
      sectors: mergedSectors,
      stages: mergedStages,
      geographies: mergedGeos,
      fitReasons: mergedReasons,
      riskFlags: mergedFlags,
      sourceConfidence: Math.max(target.sourceConfidence, duplicate.sourceConfidence),
      contactConfidence: Math.max(target.contactConfidence ?? 0, duplicate.contactConfidence ?? 0) || target.contactConfidence,
      email: target.email ?? duplicate.email,
      emailStatus: target.emailStatus === "source_backed" ? target.emailStatus : duplicate.emailStatus,
      emailConfidence: target.emailConfidence ?? duplicate.emailConfidence,
      emailSourceId: target.emailSourceId ?? duplicate.emailSourceId,
      contactUrl: target.contactUrl ?? duplicate.contactUrl,
      updatedAt: new Date(),
    })
    .where(and(eq(investorProfiles.id, target.id), eq(investorProfiles.userId, userId)))
    .returning();
  const [merged] = await db
    .update(investorProfiles)
    .set({
      duplicateStatus: "merged",
      mergedIntoInvestorId: target.id,
      updatedAt: new Date(),
    })
    .where(and(eq(investorProfiles.id, duplicate.id), eq(investorProfiles.userId, userId)))
    .returning();
  if (!updatedTarget || !merged) return null;
  return { target: updatedTarget, merged };
}

export async function dismissDuplicateCandidate(userId: string, investorId: string): Promise<InvestorProfile | null> {
  const [row] = await db
    .update(investorProfiles)
    .set({ duplicateStatus: "unique", duplicateGroupId: null, updatedAt: new Date() })
    .where(and(eq(investorProfiles.id, investorId), eq(investorProfiles.userId, userId)))
    .returning();
  return row ?? null;
}

async function getInvestor(userId: string, id: string): Promise<InvestorProfile | null> {
  const [row] = await db.select().from(investorProfiles).where(and(eq(investorProfiles.userId, userId), eq(investorProfiles.id, id))).limit(1);
  return row ?? null;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].slice(0, 20);
}
