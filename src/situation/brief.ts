import { and, eq } from "drizzle-orm";
import { situationBriefs, type InternalType } from "../db/schema.js";
import { getPlaybooks } from "./playbooks.js";

export interface SituationInput {
  description: string;
  userGoal?: string | null;
  participants?: string[] | null;
  scheduledAt?: string | Date | null;
}

export function inferSituationType(description: string): InternalType {
  const t = description.toLowerCase();
  if (/\b(loan|mortgage|apr|bank|credit)\b/.test(t)) return "bank_loan";
  if (/\b(doctor|clinic|blood test|medication|symptoms?|prescription|test results?)\b/.test(t)) {
    return "doctor_visit";
  }
  if (/\b(lawyer|legal|contract dispute|lawsuit|attorney|court)\b/.test(t)) return "legal_consultation";
  if (/\b(interview|hiring|recruiter)\b/.test(t)) return "job_interview";
  if (/\b(client|demo|pricing|sales)\b/.test(t)) return "sales_call";
  if (/\b(salary|rent|price|discount|contract|quote|negotiate|negotiating)\b/.test(t)) return "negotiation";
  if (/\b(girlfriend|boyfriend|wife|husband|relationship|partner conversation)\b/.test(t)) {
    return "personal_conversation";
  }
  if (/\b(meeting|partner|team|project)\b/.test(t)) return "business_meeting";
  return "general";
}

export function buildSituationBrief(input: SituationInput): {
  description: string;
  inferredType: InternalType;
  userGoal: string | null;
  participants: string[] | null;
  scheduledAt: Date | null;
  playbookIds: string[];
  riskLevel: "low" | "medium" | "high";
  prepQuestions: string[];
} {
  const inferredType = inferSituationType(input.description);
  const playbooks = getPlaybooks(inferredType);
  return {
    description: input.description,
    inferredType,
    userGoal: input.userGoal ?? null,
    participants: input.participants ?? null,
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
    playbookIds: playbooks.map((p) => p.id),
    riskLevel: playbooks[0]?.defaultRiskLevel ?? "medium",
    prepQuestions: [...new Set(playbooks.flatMap((p) => p.prepQuestions))],
  };
}

export async function createSituationBrief(userId: string, input: SituationInput) {
  const { db } = await import("../db/client.js");
  const brief = buildSituationBrief(input);
  const [row] = await db
    .insert(situationBriefs)
    .values({
      userId,
      description: brief.description,
      inferredType: brief.inferredType,
      userGoal: brief.userGoal,
      participants: brief.participants,
      scheduledAt: brief.scheduledAt,
      playbookIds: brief.playbookIds,
      riskLevel: brief.riskLevel,
    })
    .returning();
  if (!row) throw new Error("failed to create situation brief");
  return { brief: row, prepQuestions: brief.prepQuestions };
}

export async function getOwnedSituationBrief(userId: string, id: string) {
  const { db } = await import("../db/client.js");
  const [row] = await db
    .select()
    .from(situationBriefs)
    .where(and(eq(situationBriefs.id, id), eq(situationBriefs.userId, userId)))
    .limit(1);
  return row ?? null;
}
