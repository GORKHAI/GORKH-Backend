import { draftOutreachEmails } from "../../outreach/outreach-draft.js";
import { draftEmailsBodySchema } from "../../outreach/types.js";
import type { SubagentReport, SubagentTask, SubagentWorkerContext } from "../types.js";

export async function runOutreachDraftingSubagent(task: SubagentTask, context: SubagentWorkerContext): Promise<SubagentReport> {
  const input = normalizeInput(task.input);
  if (!input.campaignId) return failed(task, "Missing outreach campaign id.");
  await context.emitProgress("Drafting review-only investor outreach emails.");
  const parsed = draftEmailsBodySchema.parse(input);
  const drafts = await draftOutreachEmails({ userId: task.userId, campaignId: input.campaignId, input: parsed });
  return {
    taskId: task.id,
    kind: task.kind,
    status: "completed",
    title: "Investor outreach drafts ready",
    summary: drafts.length ? `Created ${drafts.length} review-only draft(s).` : "No drafts were created because no source-backed investor leads were available.",
    findings: drafts.map((draft) => ({
      claim: `${draft.subject} (${draft.status})`,
      confidence: draft.status === "proposed" ? 0.8 : 0.5,
      limitation: "Draft only. Sending remains disabled.",
    })),
    recommendedMainAgentMessage: "Investor outreach drafts are ready for human review. Nothing was sent.",
    safetyNotes: ["Draft-only.", "No email was sent.", "External sending remains disabled."],
    createdAt: new Date().toISOString(),
  };
}

function failed(task: SubagentTask, summary: string): SubagentReport {
  return {
    taskId: task.id,
    kind: task.kind,
    status: "failed",
    title: "Outreach drafting unavailable",
    summary,
    findings: [],
    recommendedMainAgentMessage: summary,
    safetyNotes: ["No outreach was sent."],
    createdAt: new Date().toISOString(),
  };
}

function normalizeInput(input: unknown): { campaignId?: string; senderIdentity?: string; ask?: string; investorIds?: string[] } {
  if (!input || typeof input !== "object") return {};
  const value = input as Record<string, unknown>;
  return {
    campaignId: typeof value.campaignId === "string" ? value.campaignId : undefined,
    senderIdentity: typeof value.senderIdentity === "string" ? value.senderIdentity : undefined,
    ask: typeof value.ask === "string" ? value.ask : undefined,
    investorIds: Array.isArray(value.investorIds) ? value.investorIds.filter((item): item is string => typeof item === "string") : undefined,
  };
}
