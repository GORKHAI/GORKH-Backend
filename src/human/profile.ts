import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { humanProfileFacts, humanProfiles, sessions, transcriptSegments, type HumanProfile, type HumanProfileFact } from "../db/schema.js";
import { extractProfileFactsFromText } from "./profile-extractor.js";
import { confirmProfileFact, insertProfileFactDrafts, rejectProfileFact } from "./profile-updater.js";
import type { HumanContextSummary } from "./types.js";

export async function getOrCreateHumanProfile(userId: string): Promise<HumanProfile> {
  const [existing] = await db.select().from(humanProfiles).where(eq(humanProfiles.userId, userId)).limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(humanProfiles)
    .values({ userId })
    .onConflictDoNothing({ target: humanProfiles.userId })
    .returning();
  if (created) return created;
  const [afterConflict] = await db.select().from(humanProfiles).where(eq(humanProfiles.userId, userId)).limit(1);
  if (!afterConflict) throw new Error("failed to create human profile");
  return afterConflict;
}

export async function proposeProfileFactsFromText(args: {
  userId: string;
  text: string;
  sessionId?: string | null;
}): Promise<HumanProfileFact[]> {
  const profile = await getOrCreateHumanProfile(args.userId);
  const drafts = extractProfileFactsFromText({ text: args.text, stressSupportOptIn: profile.stressSupportOptIn });
  return insertProfileFactDrafts({ userId: args.userId, profileId: profile.id, sourceSessionId: args.sessionId ?? null, drafts });
}

export async function proposeProfileFactsFromSession(sessionId: string): Promise<HumanProfileFact[]> {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!session) return [];
  const rows = await db
    .select({ text: transcriptSegments.text })
    .from(transcriptSegments)
    .where(eq(transcriptSegments.sessionId, sessionId))
    .orderBy(asc(transcriptSegments.offsetMs), asc(transcriptSegments.createdAt));
  if (rows.length === 0) return [];
  const profile = await getOrCreateHumanProfile(session.userId);
  const joined = rows.map((row) => row.text).join(" ");
  const drafts = extractProfileFactsFromText({
    text: joined,
    stressSupportOptIn: profile.stressSupportOptIn,
    repeatedContext: rows.map((row) => row.text),
  });
  return insertProfileFactDrafts({ userId: session.userId, profileId: profile.id, sourceSessionId: sessionId, drafts });
}

export async function applyConfirmedProfileFact(userId: string, factId: string): Promise<HumanProfileFact | null> {
  return confirmProfileFact(userId, factId);
}

export async function rejectProfileFactById(userId: string, factId: string): Promise<HumanProfileFact | null> {
  return rejectProfileFact(userId, factId);
}

export async function summarizeHumanContext(
  userId: string,
  options: { includeProposed?: boolean; currentSituation?: string | null } = {},
): Promise<HumanContextSummary> {
  const profile = await getOrCreateHumanProfile(userId);
  const facts = await db
    .select()
    .from(humanProfileFacts)
    .where(eq(humanProfileFacts.userId, userId))
    .orderBy(asc(humanProfileFacts.createdAt));
  const confirmed = facts.filter((fact) => fact.status === "confirmed");
  const goals = confirmed.filter((fact) => fact.kind === "goal").map((fact) => fact.content);
  return {
    occupation: profile.primaryOccupation,
    activeDomains: profile.activeDomains,
    activeProjects: profile.activeProjects,
    goals,
    communicationPreferences: profile.communicationStyle,
    assistantPreferences: profile.assistantPreferences,
    currentSituation: options.currentSituation ?? null,
    stressSupportOptIn: profile.stressSupportOptIn,
    confirmedFacts: confirmed.map(toSummaryFact),
    proposedFacts: options.includeProposed ? facts.filter((fact) => fact.status === "proposed").map(toSummaryFact) : undefined,
  };
}

export async function setStressSupportOptIn(userId: string, optIn: boolean): Promise<HumanProfile> {
  await getOrCreateHumanProfile(userId);
  const [profile] = await db
    .update(humanProfiles)
    .set({ stressSupportOptIn: optIn, updatedAt: new Date() })
    .where(eq(humanProfiles.userId, userId))
    .returning();
  if (!profile) throw new Error("failed to update stress support preference");
  return profile;
}

export async function getOwnedProfileFact(userId: string, factId: string): Promise<HumanProfileFact | null> {
  const [fact] = await db
    .select()
    .from(humanProfileFacts)
    .where(and(eq(humanProfileFacts.id, factId), eq(humanProfileFacts.userId, userId)))
    .limit(1);
  return fact ?? null;
}

function toSummaryFact(fact: HumanProfileFact) {
  return {
    id: fact.id,
    kind: fact.kind,
    content: fact.content,
    confidence: fact.confidence,
    sensitivity: fact.sensitivity,
  };
}
