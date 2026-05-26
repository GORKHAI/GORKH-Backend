import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { actionProposals, sessions, type ActionProposal } from "../db/schema.js";
import { logBrainAuditEvent } from "../brain/audit.js";
import { evaluateActionPolicy } from "./policy.js";
import type { CreateActionProposalInput } from "./types.js";

export async function createActionProposal(userId: string, input: CreateActionProposalInput): Promise<ActionProposal> {
  if (input.sessionId) {
    const [session] = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.id, input.sessionId), eq(sessions.userId, userId))).limit(1);
    if (!session) throw new Error("session not found");
  }
  const policy = evaluateActionPolicy({ actionType: input.actionType, payload: input.payload });
  const [proposal] = await db
    .insert(actionProposals)
    .values({
      userId,
      sessionId: input.sessionId ?? null,
      sourceType: input.sourceType,
      actionType: input.actionType,
      title: input.title,
      description: input.description,
      payload: input.payload,
      riskLevel: policy.riskLevel,
      status: policy.allowed ? "proposed" : "rejected",
      requiresApproval: policy.requiresApproval,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    })
    .returning();
  if (!proposal) throw new Error("failed to create action proposal");
  await logBrainAuditEvent({
    userId,
    sessionId: input.sessionId ?? null,
    eventType: "action_proposal",
    payload: { proposalId: proposal.id, actionType: proposal.actionType, riskLevel: proposal.riskLevel, status: proposal.status, reason: policy.reason },
  }).catch(() => null);
  return proposal;
}

export async function listActionProposals(userId: string): Promise<ActionProposal[]> {
  return db.select().from(actionProposals).where(eq(actionProposals.userId, userId)).orderBy(desc(actionProposals.createdAt)).limit(100);
}

export async function getOwnedActionProposal(userId: string, proposalId: string): Promise<ActionProposal | null> {
  const [proposal] = await db.select().from(actionProposals).where(and(eq(actionProposals.id, proposalId), eq(actionProposals.userId, userId))).limit(1);
  return proposal ?? null;
}
