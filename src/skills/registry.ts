import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { skillVersions, skills, type Skill } from "../db/schema.js";
import { isSkillSafe, validateSkillManifest } from "./learner.js";
import type { SkillDraft } from "./types.js";
import { logBrainAuditEvent } from "../brain/audit.js";

export async function createProposedSkill(userId: string, draft: SkillDraft): Promise<Skill | null> {
  const validation = validateSkillManifest(draft);
  if (!validation.ok || !isSkillSafe(draft)) return null;
  const [row] = await db
    .insert(skills)
    .values({
      userId,
      name: draft.name,
      description: draft.description,
      triggerPattern: draft.triggerPattern,
      steps: draft.steps,
      status: "proposed",
      source: "learned",
      riskLevel: draft.riskLevel,
    })
    .returning();
  if (row) {
    await db.insert(skillVersions).values({
      skillId: row.id,
      userId,
      version: 1,
      manifest: { ...draft, status: "proposed", source: "learned" },
    });
    await logBrainAuditEvent({
      userId,
      sessionId: null,
      eventType: "skill_proposal",
      payload: { skillId: row.id, name: row.name, riskLevel: row.riskLevel, status: row.status },
    }).catch(() => null);
  }
  return row ?? null;
}

export async function listUserSkills(userId: string): Promise<Skill[]> {
  return db.select().from(skills).where(eq(skills.userId, userId));
}

export async function approveSkill(userId: string, skillId: string): Promise<Skill | null> {
  const [row] = await db.update(skills).set({ status: "approved", updatedAt: new Date() }).where(and(eq(skills.id, skillId), eq(skills.userId, userId))).returning();
  return row ?? null;
}

export async function enableSkill(userId: string, skillId: string): Promise<Skill | null> {
  const [current] = await db.select().from(skills).where(and(eq(skills.id, skillId), eq(skills.userId, userId))).limit(1);
  if (!current || !["approved", "enabled"].includes(current.status)) return null;
  const [row] = await db.update(skills).set({ status: "enabled", updatedAt: new Date() }).where(and(eq(skills.id, skillId), eq(skills.userId, userId))).returning();
  return row ?? null;
}

export async function disableSkill(userId: string, skillId: string): Promise<Skill | null> {
  const [row] = await db.update(skills).set({ status: "disabled", updatedAt: new Date() }).where(and(eq(skills.id, skillId), eq(skills.userId, userId))).returning();
  return row ?? null;
}

export async function matchEnabledSkillsForSituation(userId: string, text: string): Promise<Skill[]> {
  const enabled = (await listUserSkills(userId)).filter((skill) => skill.status === "enabled");
  return enabled.filter((skill) => new RegExp(skill.triggerPattern, "i").test(text));
}
