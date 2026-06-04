import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { humanProfileFacts, skills, type HumanFactKind, type HumanFactStatus, type Sensitivity, type SkillStatus } from "../db/schema.js";
import { getOrCreateHumanProfile } from "../human/profile.js";
import { validateSkillManifest } from "../skills/learner.js";

export const MEMORY_SKILLS_EXPORT_SCHEMA_VERSION = "nearmind.memory_skills.v0";

export interface MemorySkillsExport {
  schemaVersion: typeof MEMORY_SKILLS_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  profileFacts: Array<{
    kind: HumanFactKind;
    content: string;
    confidence: number;
    sensitivity: Sensitivity;
    status: HumanFactStatus;
  }>;
  skills: Array<{
    name: string;
    description: string;
    triggerPattern: string;
    steps: string[];
    riskLevel: "low" | "medium" | "high";
    status: SkillStatus;
  }>;
  policy: {
    rawTokensIncluded: false;
    connectorCredentialsIncluded: false;
    sensitiveFactsIncluded: boolean;
  };
}

export async function exportMemorySkills(
  userId: string,
  options: { includeProposed?: boolean; includeRejected?: boolean; includeSensitive?: boolean } = {},
): Promise<MemorySkillsExport> {
  const statuses: HumanFactStatus[] = ["confirmed"];
  if (options.includeProposed) statuses.push("proposed");
  if (options.includeRejected) statuses.push("rejected");
  const facts = await db
    .select()
    .from(humanProfileFacts)
    .where(and(eq(humanProfileFacts.userId, userId), inArray(humanProfileFacts.status, statuses)));
  const enabledSkills = await db.select().from(skills).where(and(eq(skills.userId, userId), eq(skills.status, "enabled")));
  const allowedFacts = facts.filter((fact) => fact.sensitivity !== "sensitive" || options.includeSensitive === true);
  return {
    schemaVersion: MEMORY_SKILLS_EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profileFacts: allowedFacts.map((fact) => ({
      kind: fact.kind,
      content: fact.content,
      confidence: fact.confidence,
      sensitivity: fact.sensitivity,
      status: fact.status,
    })),
    skills: enabledSkills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      triggerPattern: skill.triggerPattern,
      steps: skill.steps,
      riskLevel: skill.riskLevel as "low" | "medium" | "high",
      status: skill.status,
    })),
    policy: {
      rawTokensIncluded: false,
      connectorCredentialsIncluded: false,
      sensitiveFactsIncluded: allowedFacts.some((fact) => fact.sensitivity === "sensitive"),
    },
  };
}

export async function importMemorySkills(args: {
  userId: string;
  payload: unknown;
  allowSensitiveImport?: boolean;
}): Promise<{
  schemaVersion: typeof MEMORY_SKILLS_EXPORT_SCHEMA_VERSION;
  importedFacts: number;
  skippedFacts: number;
  importedSkills: number;
  skippedSkills: number;
  warnings: string[];
}> {
  const payload = parsePortablePayload(args.payload);
  const profile = await getOrCreateHumanProfile(args.userId);
  const warnings: string[] = [];
  const factValues = payload.profileFacts
    .filter((fact) => {
      if (fact.sensitivity === "sensitive" && !args.allowSensitiveImport) {
        warnings.push("sensitive_fact_skipped_requires_explicit_opt_in");
        return false;
      }
      if (fact.kind === "stress_support_preference" && !profile.stressSupportOptIn && !args.allowSensitiveImport) {
        warnings.push("stress_support_preference_skipped_requires_opt_in");
        return false;
      }
      return true;
    })
    .map((fact) => ({
      userId: args.userId,
      profileId: profile.id,
      kind: fact.kind,
      content: fact.content,
      sourceSessionId: null,
      source: "imported" as const,
      confidence: clamp01(fact.confidence),
      sensitivity: fact.sensitivity,
      status: "proposed" as const,
    }));
  const insertedFacts = factValues.length ? await db.insert(humanProfileFacts).values(factValues).returning({ id: humanProfileFacts.id }) : [];
  const skillValues = payload.skills
    .filter((skill) => {
      const validation = validateSkillManifest(skill);
      if (!validation.ok) warnings.push(`skill_skipped:${skill.name}:${validation.reason}`);
      return validation.ok;
    })
    .map((skill) => ({
      userId: args.userId,
      name: skill.name,
      description: skill.description,
      triggerPattern: skill.triggerPattern,
      steps: skill.steps,
      status: "proposed" as const,
      source: "manual" as const,
      riskLevel: skill.riskLevel,
    }));
  const insertedSkills = skillValues.length ? await db.insert(skills).values(skillValues).returning({ id: skills.id }) : [];
  return {
    schemaVersion: MEMORY_SKILLS_EXPORT_SCHEMA_VERSION,
    importedFacts: insertedFacts.length,
    skippedFacts: payload.profileFacts.length - insertedFacts.length,
    importedSkills: insertedSkills.length,
    skippedSkills: payload.skills.length - insertedSkills.length,
    warnings,
  };
}

function parsePortablePayload(payload: unknown): Pick<MemorySkillsExport, "profileFacts" | "skills"> {
  if (!payload || typeof payload !== "object") throw new Error("invalid_import_payload");
  const record = payload as Partial<MemorySkillsExport>;
  if (record.schemaVersion !== MEMORY_SKILLS_EXPORT_SCHEMA_VERSION) throw new Error("unsupported_import_schema");
  return {
    profileFacts: Array.isArray(record.profileFacts) ? record.profileFacts.map(parseFact) : [],
    skills: Array.isArray(record.skills) ? record.skills.map(parseSkill) : [],
  };
}

function parseFact(value: unknown): MemorySkillsExport["profileFacts"][number] {
  const item = value as Partial<MemorySkillsExport["profileFacts"][number]>;
  if (!item.kind || !item.content) throw new Error("invalid_import_fact");
  return {
    kind: item.kind,
    content: String(item.content).slice(0, 1000),
    confidence: typeof item.confidence === "number" ? item.confidence : 0.5,
    sensitivity: item.sensitivity ?? "low",
    status: item.status ?? "confirmed",
  };
}

function parseSkill(value: unknown): MemorySkillsExport["skills"][number] {
  const item = value as Partial<MemorySkillsExport["skills"][number]>;
  if (!item.name || !item.description || !item.triggerPattern || !Array.isArray(item.steps)) throw new Error("invalid_import_skill");
  const riskLevel = item.riskLevel && ["low", "medium", "high"].includes(item.riskLevel) ? item.riskLevel : "low";
  return {
    name: String(item.name).slice(0, 120),
    description: String(item.description).slice(0, 500),
    triggerPattern: String(item.triggerPattern).slice(0, 250),
    steps: item.steps.map((step) => String(step).slice(0, 500)).slice(0, 20),
    riskLevel,
    status: item.status ?? "enabled",
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
