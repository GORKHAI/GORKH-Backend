import { evaluateActionPolicy, isSafeInternalExecutable } from "./policy.js";
import type { ActionProposal } from "../db/schema.js";

export function previewActionProposal(proposal: ActionProposal) {
  const policy = evaluateActionPolicy({ actionType: proposal.actionType, payload: proposal.payload as Record<string, unknown> });
  const safeInternal = isSafeInternalExecutable(proposal.actionType);
  const external = !safeInternal;
  const blockedReason = external ? connectorBlockReason(proposal.actionType) : null;
  return {
    proposalId: proposal.id,
    actionType: proposal.actionType,
    title: proposal.title,
    whatWouldHappen: safeInternal
      ? "After approval, GORKH can execute this internal action inside its own backend state."
      : "GORKH would only create or show a draft/proposal. No external connector write will be executed in v0.",
    riskLevel: policy.riskLevel,
    requiredApprovals: ["user_approval", ...(external ? ["future_connector_write_approval"] : [])],
    connectorStatus: external ? { configured: false, reason: blockedReason } : { configured: true, reason: "internal_action" },
    canExecute: safeInternal && proposal.status === "approved",
    cannotExecuteReason: proposal.status !== "approved" ? "approval_required" : blockedReason,
    externalWritesDisabled: true,
    noSendNoCreateNoDelete: true,
  };
}

function connectorBlockReason(actionType: string): string {
  // The current milestone has no production token vault or external write executor.
  if (actionType === "draft_email" || actionType === "draft_followup_message") return "draft_only_no_send";
  if (actionType === "propose_calendar_event") return "calendar_create_disabled_proposal_only";
  return "connector_not_configured";
}
