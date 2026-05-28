import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { actionExecutionLogs, actionProposals, humanProfileFacts, skills, taskItems, type ActionExecutionLog } from "../db/schema.js";
import { updateTaskStatus } from "../daily/task-inbox.js";
import { applyConfirmedProfileFact } from "../human/profile.js";
import { enableSkill } from "../skills/registry.js";
import { isSafeInternalExecutable } from "./policy.js";
import { ActionPolicyError } from "./types.js";

export async function executeActionProposal(userId: string, proposalId: string): Promise<{ log: ActionExecutionLog; result?: unknown }> {
  const [proposal] = await db.select().from(actionProposals).where(and(eq(actionProposals.id, proposalId), eq(actionProposals.userId, userId))).limit(1);
  if (!proposal) throw new ActionPolicyError("not_found", "Action proposal not found");
  if (proposal.status !== "approved") throw new ActionPolicyError("approval_required", "Action proposal must be approved before execution");
  if (!isSafeInternalExecutable(proposal.actionType)) {
    const errorCode = proposal.actionType === "propose_calendar_event" ? "external_write_disabled" : "connector_not_configured";
    const log = await recordExecution(userId, proposalId, "blocked", null, errorCode);
    await markProposal(userId, proposalId, "failed");
    return {
      log,
      result: {
        code: errorCode,
        message: proposal.actionType === "propose_calendar_event" ? "Google Calendar writes are disabled in v0. Only read-only sync and internal proposals are allowed." : "External connector actions are disabled or not configured in v0.",
      },
    };
  }

  try {
    const result = await executeInternal(userId, proposal);
    const log = await recordExecution(userId, proposalId, "completed", result, null);
    await markProposal(userId, proposalId, "executed");
    return { log, result };
  } catch (err) {
    const log = await recordExecution(userId, proposalId, "failed", null, (err as Error).message);
    await markProposal(userId, proposalId, "failed");
    return { log, result: { error: (err as Error).message } };
  }
}

async function executeInternal(userId: string, proposal: typeof actionProposals.$inferSelect): Promise<unknown> {
  const payload = proposal.payload as Record<string, unknown>;
  if (proposal.actionType === "propose_reminder" || proposal.actionType === "research_watchlist_create") {
    const [task] = await db
      .insert(taskItems)
      .values({
        userId,
        sessionId: proposal.sessionId,
        commitmentId: null,
        title: String(payload.title ?? proposal.title),
        detail: String(payload.detail ?? proposal.description),
        priority: String(payload.priority ?? "normal") as never,
        status: "accepted",
        sourceType: "action_proposal",
        sourceId: proposal.id,
        dueAt: typeof payload.dueAt === "string" ? new Date(payload.dueAt) : null,
        acceptedAt: new Date(),
      })
      .returning();
    return { task };
  }
  if (proposal.actionType === "create_task_from_commitment") {
    const taskId = String(payload.taskId ?? "");
    if (!taskId) throw new Error("payload.taskId is required");
    const task = await updateTaskStatus(userId, taskId, "accepted");
    if (!task) throw new Error("task not found");
    return { task };
  }
  if (proposal.actionType === "profile_fact_confirm") {
    const factId = String(payload.factId ?? "");
    if (!factId) throw new Error("payload.factId is required");
    const [factRow] = await db.select({ id: humanProfileFacts.id }).from(humanProfileFacts).where(and(eq(humanProfileFacts.id, factId), eq(humanProfileFacts.userId, userId))).limit(1);
    if (!factRow) throw new Error("profile fact not found");
    return { fact: await applyConfirmedProfileFact(userId, factId) };
  }
  if (proposal.actionType === "skill_enable") {
    const skillId = String(payload.skillId ?? "");
    if (!skillId) throw new Error("payload.skillId is required");
    const [skillRow] = await db.select({ id: skills.id }).from(skills).where(and(eq(skills.id, skillId), eq(skills.userId, userId))).limit(1);
    if (!skillRow) throw new Error("skill not found");
    return { skill: await enableSkill(userId, skillId) };
  }
  throw new Error(`unsupported internal action ${proposal.actionType}`);
}

async function recordExecution(userId: string, proposalId: string, status: "completed" | "failed" | "blocked" | "dry_run", result: unknown, error: string | null): Promise<ActionExecutionLog> {
  const [log] = await db.insert(actionExecutionLogs).values({ proposalId, userId, status, result: result ?? null, error }).returning();
  if (!log) throw new Error("failed to record action execution");
  return log;
}

async function markProposal(userId: string, proposalId: string, status: "executed" | "failed"): Promise<void> {
  await db.update(actionProposals).set({ status, updatedAt: new Date() }).where(and(eq(actionProposals.id, proposalId), eq(actionProposals.userId, userId)));
}
