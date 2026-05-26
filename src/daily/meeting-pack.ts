import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { followupSuggestions, meetingPacks, sessions, situationBriefs, transcriptSegments, type InternalType, type MeetingPack } from "../db/schema.js";
import { summarizeHumanContext } from "../human/profile.js";
import { getPlaybooks, safetyBoundariesFor } from "../situation/playbooks.js";
import { buildSituationBrief } from "../situation/brief.js";
import { extractCommitmentsFromText } from "./commitment-extractor.js";
import { detectFollowupSuggestion } from "./followup-detector.js";
import type { MeetingPackDraft } from "./types.js";

export async function buildPrepPackDraft(args: {
  userId: string;
  title?: string | null;
  situationDescription: string;
  situationBriefId?: string | null;
}): Promise<MeetingPackDraft> {
  const brief = args.situationBriefId
    ? await getBrief(args.userId, args.situationBriefId)
    : buildSituationBrief({ description: args.situationDescription });
  const internalType = brief?.inferredType ?? "general";
  const context = await summarizeHumanContext(args.userId).catch(() => null);
  return buildPrepPackDraftFromContext({
    title: args.title,
    situationDescription: args.situationDescription,
    internalType,
    occupation: context?.occupation ?? null,
  });
}

export function buildPrepPackDraftFromContext(args: {
  title?: string | null;
  situationDescription: string;
  internalType: InternalType;
  occupation?: string | null;
}): MeetingPackDraft {
  const playbooks = getPlaybooks(args.internalType);
  return {
    title: args.title ?? `Prep: ${args.situationDescription}`,
    packType: "prep",
    sections: [
      { title: "Goal", items: [args.situationDescription] },
      { title: "Known context", items: [args.occupation ? `Confirmed profile context: ${args.occupation}` : "No confirmed profile context needed."] },
      { title: "People and organizations", items: extractPeopleOrgs(args.situationDescription) },
      { title: "Documents to request", items: documentsFor(args.internalType) },
      { title: "Safety boundary", items: safetyBoundariesFor(args.internalType).slice(0, 3) },
    ],
    risks: unique(playbooks.flatMap((p) => p.redFlags)).slice(0, 6),
    suggestedQuestions: unique(playbooks.flatMap((p) => p.prepQuestions)).slice(0, 8),
    followups: ["Confirm owners, deadlines, missing documents, and what will happen next."],
  };
}

export async function createPrepPack(args: {
  userId: string;
  title?: string | null;
  situationDescription: string;
  situationBriefId?: string | null;
}): Promise<MeetingPack> {
  const draft = await buildPrepPackDraft(args);
  const [row] = await db
    .insert(meetingPacks)
    .values({
      userId: args.userId,
      situationBriefId: args.situationBriefId ?? null,
      sessionId: null,
      title: draft.title,
      packType: "prep",
      sections: draft.sections,
      risks: draft.risks,
      suggestedQuestions: draft.suggestedQuestions,
      followups: draft.followups,
    })
    .returning();
  if (!row) throw new Error("failed to create prep pack");
  return row;
}

export async function buildRecapPackDraft(args: { userId: string; sessionId: string; title?: string | null }): Promise<MeetingPackDraft | null> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, args.sessionId), eq(sessions.userId, args.userId)))
    .limit(1);
  if (!session || session.status !== "saved") return null;
  const rows = await db.select().from(transcriptSegments).where(eq(transcriptSegments.sessionId, args.sessionId)).orderBy(asc(transcriptSegments.offsetMs), asc(transcriptSegments.createdAt));
  const text = rows.map((row) => row.text).join(" ");
  const proposed = extractCommitmentsFromText({ text, sourceType: "transcript", internalType: session.internalType });
  const followup = detectFollowupSuggestion(text);
  return {
    title: args.title ?? `Recap: ${session.title ?? session.internalType}`,
    packType: "recap",
    sections: [
      { title: "Summary", items: [text ? summarizeText(text) : "No transcript content was available."] },
      { title: "Decisions", items: extractDecisionLines(text) },
      { title: "Missing info", items: missingInfoFor(session.internalType) },
      { title: "Draft follow-up", items: [followup?.suggestedMessage ?? "Draft only: confirm decisions, owners, deadlines, and missing information before sending elsewhere."] },
    ],
    risks: safetyBoundariesFor(session.internalType).slice(0, 4),
    suggestedQuestions: getPlaybooks(session.internalType).flatMap((p) => p.prepQuestions).slice(0, 5),
    followups: proposed.map((item) => item.title).concat(followup ? [followup.reason] : []).slice(0, 8),
  };
}

export async function createRecapPack(args: { userId: string; sessionId: string; title?: string | null }): Promise<MeetingPack | null> {
  const draft = await buildRecapPackDraft(args);
  if (!draft) return null;
  const [session] = await db.select({ situationBriefId: sessions.situationBriefId }).from(sessions).where(eq(sessions.id, args.sessionId)).limit(1);
  const [row] = await db
    .insert(meetingPacks)
    .values({
      userId: args.userId,
      situationBriefId: session?.situationBriefId ?? null,
      sessionId: args.sessionId,
      title: draft.title,
      packType: "recap",
      sections: draft.sections,
      risks: draft.risks,
      suggestedQuestions: draft.suggestedQuestions,
      followups: draft.followups,
    })
    .returning();
  return row ?? null;
}

export async function getOwnedMeetingPack(userId: string, packId: string): Promise<MeetingPack | null> {
  const [row] = await db.select().from(meetingPacks).where(and(eq(meetingPacks.id, packId), eq(meetingPacks.userId, userId))).limit(1);
  return row ?? null;
}

export async function createRecapPackAndDailyItems(args: { userId: string; sessionId: string; internalType: InternalType }): Promise<void> {
  await createRecapPack({ userId: args.userId, sessionId: args.sessionId }).catch(() => null);
  const rows = await db.select().from(transcriptSegments).where(eq(transcriptSegments.sessionId, args.sessionId));
  const text = rows.map((row) => row.text).join(" ");
  const followup = detectFollowupSuggestion(text);
  if (followup) {
    await db.insert(followupSuggestions).values({
      userId: args.userId,
      sessionId: args.sessionId,
      personName: followup.personName ?? null,
      organizationName: followup.organizationName ?? null,
      reason: followup.reason,
      suggestedMessage: followup.suggestedMessage,
      status: "proposed",
    });
  }
}

async function getBrief(userId: string, id: string) {
  const [row] = await db.select().from(situationBriefs).where(and(eq(situationBriefs.id, id), eq(situationBriefs.userId, userId))).limit(1);
  return row ?? null;
}

function documentsFor(internalType: InternalType): string[] {
  if (internalType === "bank_loan") return ["Full repayment schedule", "All fees in writing", "APR basis", "Fixed/variable terms", "Early repayment terms"];
  if (internalType === "doctor_visit") return ["Test result copy", "Medication list", "Follow-up instructions", "Warning signs to watch for"];
  if (internalType === "legal_consultation") return ["Written scope", "Fees", "Deadlines", "Relevant documents"];
  return ["Written next steps", "Owners", "Deadlines", "Open questions"];
}

function missingInfoFor(internalType: InternalType): string[] {
  if (internalType === "bank_loan") return ["Total repayment amount", "Mandatory fees", "Whether terms are fixed or variable"];
  if (internalType === "doctor_visit") return ["What the result means", "Warning signs", "Follow-up timing"];
  return ["Owner", "Deadline", "Decision record"];
}

function extractPeopleOrgs(text: string): string[] {
  const items = ["bank", "doctor", "client", "partner", "lawyer", "team"].filter((word) => new RegExp(`\\b${word}\\b`, "i").test(text));
  return items.length ? items : ["Confirm who owns each next step."];
}

function extractDecisionLines(text: string): string[] {
  const matches = text.match(/[^.!?]*\b(decided|agreed|approved|rejected|will)\b[^.!?]*/gi) ?? [];
  return matches.map((line) => line.trim()).filter(Boolean).slice(0, 6).concat(matches.length ? [] : ["No explicit decision detected."]);
}

function summarizeText(text: string): string {
  return text.length > 420 ? `${text.slice(0, 417)}...` : text;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
