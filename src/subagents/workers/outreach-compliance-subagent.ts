import { checkOutboundCompliance, recordOutreachComplianceEvent } from "../../outreach/compliance.js";
import { getOwnedOutreachDraft } from "../../outreach/outreach-draft.js";
import type { SubagentReport, SubagentTask, SubagentWorkerContext } from "../types.js";

export async function runOutreachComplianceSubagent(task: SubagentTask, context: SubagentWorkerContext): Promise<SubagentReport> {
  const input = normalizeInput(task.input);
  if (!input.draftId) return failed(task, "Missing outreach draft id.");
  const draft = await getOwnedOutreachDraft(task.userId, input.draftId);
  if (!draft) return failed(task, "Outreach draft not found.");
  await context.emitProgress("Checking outbound compliance guardrails.");
  const result = checkOutboundCompliance({
    subject: draft.subject,
    body: draft.body,
    hasSourceBackedPersonalization: Array.isArray(draft.sourceIds) && draft.sourceIds.length > 0,
    scaledCampaign: Boolean(input.scaledCampaign),
  });
  await recordOutreachComplianceEvent({
    userId: task.userId,
    campaignId: draft.campaignId,
    draftId: draft.id,
    eventType: "outbound_compliance_check",
    payload: result,
  });
  return {
    taskId: task.id,
    kind: task.kind,
    status: result.ok ? "completed" : "failed",
    title: result.ok ? "Outreach compliance check passed" : "Outreach compliance check failed",
    summary: result.ok ? "Draft is reviewable, but still not sendable by GORKH v0." : result.blockedReasons.join(" "),
    findings: [...result.notes, ...result.blockedReasons].map((note) => ({ claim: note, confidence: result.ok ? 0.8 : 0.95 })),
    recommendedMainAgentMessage: result.ok ? "The draft passed compliance checks and remains review-only." : "The outreach draft needs edits before approval.",
    safetyNotes: ["No email was sent.", "Scaled campaigns need legal/compliance review."],
    createdAt: new Date().toISOString(),
  };
}

function failed(task: SubagentTask, summary: string): SubagentReport {
  return {
    taskId: task.id,
    kind: task.kind,
    status: "failed",
    title: "Outreach compliance unavailable",
    summary,
    findings: [],
    recommendedMainAgentMessage: summary,
    safetyNotes: ["No outreach was sent."],
    createdAt: new Date().toISOString(),
  };
}

function normalizeInput(input: unknown): { draftId?: string; scaledCampaign?: boolean } {
  if (!input || typeof input !== "object") return {};
  const value = input as Record<string, unknown>;
  return {
    draftId: typeof value.draftId === "string" ? value.draftId : undefined,
    scaledCampaign: typeof value.scaledCampaign === "boolean" ? value.scaledCampaign : undefined,
  };
}
