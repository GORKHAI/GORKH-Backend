import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { actionApprovals, actionProposals, type ActionApproval, type ActionProposal } from "../db/schema.js";
import { logBrainAuditEvent } from "../brain/audit.js";

export async function approveActionProposal(userId: string, proposalId: string, reason?: string | null): Promise<{ proposal: ActionProposal; approval: ActionApproval } | null> {
  return decideActionProposal(userId, proposalId, "approved", reason);
}

export async function rejectActionProposal(userId: string, proposalId: string, reason?: string | null): Promise<{ proposal: ActionProposal; approval: ActionApproval } | null> {
  return decideActionProposal(userId, proposalId, "rejected", reason);
}

async function decideActionProposal(
  userId: string,
  proposalId: string,
  decision: "approved" | "rejected",
  reason?: string | null,
): Promise<{ proposal: ActionProposal; approval: ActionApproval } | null> {
  const [existing] = await db.select().from(actionProposals).where(and(eq(actionProposals.id, proposalId), eq(actionProposals.userId, userId))).limit(1);
  if (!existing) return null;
  if (!["proposed", "approved"].includes(existing.status) && decision === "approved") throw new Error(`cannot approve proposal in status ${existing.status}`);
  if (["executed", "expired"].includes(existing.status)) throw new Error(`cannot reject proposal in status ${existing.status}`);
  const [proposal] = await db
    .update(actionProposals)
    .set({ status: decision, updatedAt: new Date() })
    .where(and(eq(actionProposals.id, proposalId), eq(actionProposals.userId, userId)))
    .returning();
  const [approval] = await db.insert(actionApprovals).values({ proposalId, userId, decision, reason: reason ?? null }).returning();
  if (!proposal || !approval) throw new Error("failed to record action decision");
  await logBrainAuditEvent({
    userId,
    sessionId: proposal.sessionId,
    eventType: "action_approval",
    payload: { proposalId, actionType: proposal.actionType, decision },
  }).catch(() => null);
  return { proposal, approval };
}
