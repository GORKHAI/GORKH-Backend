import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { brainReflections, sessions } from "../db/schema.js";
import type { BufferedSegment } from "../redis.js";
import { proposeProfileFactsFromSession } from "../human/profile.js";
import { proposeSkillFromReflection } from "../skills/learner.js";
import { createProposedSkill } from "../skills/registry.js";

export async function reflectOnSavedSession(args: { userId: string; sessionId: string; transcript: BufferedSegment[] }) {
  if (!config.ADAPTIVE_LEARNING_ENABLED) return null;
  const [session] = await db.select().from(sessions).where(eq(sessions.id, args.sessionId)).limit(1);
  if (!session || session.status !== "saved") return null;
  const text = args.transcript.map((seg) => seg.text).join(" ");
  const proposedFacts = await proposeProfileFactsFromSession(args.sessionId);
  const skillDraft = config.ADAPTIVE_SKILL_LEARNING_ENABLED ? proposeSkillFromReflection({ text, internalType: session.internalType }) : null;
  const proposedSkill = skillDraft ? await createProposedSkill(args.userId, skillDraft) : null;
  const [reflection] = await db
    .insert(brainReflections)
    .values({
      userId: args.userId,
      sessionId: args.sessionId,
      reflectionType: "session_review",
      inputSummary: summarizeTranscript(text),
      output: {
        whatWorked: "Captured session signals for possible profile and workflow improvements.",
        whatFailed: "No autonomous judgement; user confirmation is required for sensitive facts and skills.",
        proposedProfileFactIds: proposedFacts.map((fact) => fact.id),
        proposedSkillId: proposedSkill?.id ?? null,
      },
      status: "proposed",
    })
    .returning();
  return reflection ?? null;
}

function summarizeTranscript(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length > 400 ? `${trimmed.slice(0, 397)}...` : trimmed || "Saved session had no transcript text.";
}
