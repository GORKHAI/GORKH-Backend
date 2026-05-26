import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { humanProfileFacts, humanProfiles, type HumanProfile, type HumanProfileFact } from "../db/schema.js";
import type { ProfileFactDraft } from "./types.js";

export async function insertProfileFactDrafts(args: {
  userId: string;
  profileId: string;
  sourceSessionId?: string | null;
  drafts: ProfileFactDraft[];
}): Promise<HumanProfileFact[]> {
  if (args.drafts.length === 0) return [];
  const rows = await db
    .insert(humanProfileFacts)
    .values(
      args.drafts.map((draft) => ({
        userId: args.userId,
        profileId: args.profileId,
        kind: draft.kind,
        content: draft.content,
        sourceSessionId: args.sourceSessionId ?? null,
        source: draft.source,
        confidence: draft.confidence,
        sensitivity: draft.sensitivity,
        status: draft.status,
      })),
    )
    .returning();
  for (const row of rows.filter((fact) => fact.status === "confirmed")) {
    await applyFactToProfile(args.userId, row);
  }
  return rows;
}

export async function confirmProfileFact(userId: string, factId: string): Promise<HumanProfileFact | null> {
  const [fact] = await db
    .update(humanProfileFacts)
    .set({ status: "confirmed", source: "confirmed", updatedAt: new Date() })
    .where(and(eq(humanProfileFacts.id, factId), eq(humanProfileFacts.userId, userId)))
    .returning();
  if (!fact) return null;
  await applyFactToProfile(userId, fact);
  return fact;
}

export async function rejectProfileFact(userId: string, factId: string): Promise<HumanProfileFact | null> {
  const [fact] = await db
    .update(humanProfileFacts)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(and(eq(humanProfileFacts.id, factId), eq(humanProfileFacts.userId, userId)))
    .returning();
  return fact ?? null;
}

async function applyFactToProfile(userId: string, fact: HumanProfileFact): Promise<void> {
  const [profile] = await db.select().from(humanProfiles).where(eq(humanProfiles.userId, userId)).limit(1);
  if (!profile) return;
  const patch = buildProfilePatch(profile, fact);
  if (Object.keys(patch).length === 0) return;
  await db.update(humanProfiles).set({ ...patch, updatedAt: new Date() }).where(eq(humanProfiles.id, profile.id));
}

function buildProfilePatch(profile: HumanProfile, fact: HumanProfileFact): Partial<HumanProfile> {
  if (fact.sensitivity === "sensitive" && fact.kind !== "stress_support_preference") return {};
  if (fact.kind === "occupation") {
    return { primaryOccupation: fact.content, occupationConfidence: Math.max(profile.occupationConfidence ?? 0, fact.confidence) };
  }
  if (fact.kind === "project") return { activeProjects: appendUnique(profile.activeProjects, fact.content) };
  if (fact.kind === "goal") return { assistantPreferences: { ...profile.assistantPreferences, goal: fact.content } };
  if (fact.kind === "communication_style") {
    return { communicationStyle: { ...profile.communicationStyle, preference: fact.content } };
  }
  if (fact.kind === "preference") {
    return { assistantPreferences: { ...profile.assistantPreferences, preference: fact.content } };
  }
  return {};
}

function appendUnique(values: string[], next: string): string[] {
  const normalized = next.toLowerCase();
  if (values.some((value) => value.toLowerCase() === normalized)) return values;
  return [...values, next].slice(-12);
}
