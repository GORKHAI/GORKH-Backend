import { createPrepPack, createRecapPack } from "../../daily/meeting-pack.js";
import type { SubagentReport, SubagentTask, SubagentWorkerContext } from "../types.js";

export async function runMeetingPackSubagent(task: SubagentTask, context: SubagentWorkerContext): Promise<SubagentReport> {
  const input = task.input as { packType?: "prep" | "recap"; situationDescription?: string; situationBriefId?: string | null; sessionId?: string | null; title?: string | null };
  await context.emitProgress("Building meeting pack...");
  const pack =
    input.packType === "recap"
      ? input.sessionId
        ? await createRecapPack({ userId: task.userId, sessionId: input.sessionId, title: input.title ?? null })
        : null
      : await createPrepPack({
          userId: task.userId,
          situationDescription: input.situationDescription ?? "Upcoming meeting",
          situationBriefId: input.situationBriefId ?? task.situationBriefId ?? null,
          title: input.title ?? null,
        });
  if (!pack) {
    return {
      taskId: task.id,
      kind: task.kind,
      status: "failed",
      title: "Meeting pack unavailable",
      summary: "A recap pack requires a saved session.",
      findings: [],
      recommendedMainAgentMessage: "I could not create the recap because the session is not saved.",
      safetyNotes: ["No meeting content was fabricated."],
      createdAt: new Date().toISOString(),
    };
  }
  return {
    taskId: task.id,
    kind: task.kind,
    status: "completed",
    title: "Meeting pack ready",
    summary: `${pack.packType} pack created: ${pack.title}.`,
    findings: [{ claim: `Meeting pack ${pack.id} created.`, confidence: 1 }],
    recommendedMainAgentMessage: "Your meeting pack is ready on screen.",
    safetyNotes: ["Draft follow-ups are drafts only and require user approval before use."],
    createdAt: new Date().toISOString(),
  };
}
