import { asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { commitments, followupSuggestions, meetingPacks, sessions, taskItems, transcriptSegments, type InternalType } from "../db/schema.js";
import { logBrainAuditEvent } from "../brain/audit.js";
import { proposeCommitmentsFromSavedSession } from "./commitment-extractor.js";
import { createRecapPackAndDailyItems } from "./meeting-pack.js";
import { proposeTasksForCommitments } from "./task-inbox.js";

export async function processSavedSessionDailyLife(args: { userId: string; sessionId: string; internalType: InternalType }): Promise<{
  commitmentIds: string[];
  taskIds: string[];
}> {
  const [session] = await db
    .select({ status: sessions.status })
    .from(sessions)
    .where(eq(sessions.id, args.sessionId))
    .limit(1);
  if (session?.status !== "saved") return { commitmentIds: [], taskIds: [] };
  const proposed = await proposeCommitmentsFromSavedSession(args);
  const tasks = await proposeTasksForCommitments(proposed);
  await createRecapPackAndDailyItems(args);
  await logBrainAuditEvent({
    userId: args.userId,
    sessionId: args.sessionId,
    eventType: "daily_life_extraction",
    payload: { proposedCommitments: proposed.length, proposedTasks: tasks.length },
  }).catch(() => null);
  return { commitmentIds: proposed.map((row) => row.id), taskIds: tasks.map((row) => row.id) };
}

export async function deleteDailySessionArtifacts(sessionId: string): Promise<void> {
  await db.delete(taskItems).where(eq(taskItems.sessionId, sessionId));
  await db.delete(followupSuggestions).where(eq(followupSuggestions.sessionId, sessionId));
  await db.delete(meetingPacks).where(eq(meetingPacks.sessionId, sessionId));
  await db.delete(commitments).where(eq(commitments.sessionId, sessionId));
}

export async function readSessionTranscriptText(sessionId: string): Promise<string> {
  const rows = await db.select().from(transcriptSegments).where(eq(transcriptSegments.sessionId, sessionId)).orderBy(asc(transcriptSegments.offsetMs), asc(transcriptSegments.createdAt));
  return rows.map((row) => row.text).join(" ");
}
