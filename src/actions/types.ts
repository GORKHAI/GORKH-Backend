import { z } from "zod";

export const actionTypeSchema = z.enum([
  "draft_email",
  "propose_calendar_event",
  "propose_reminder",
  "draft_followup_message",
  "create_task_from_commitment",
  "research_watchlist_create",
  "profile_fact_confirm",
  "skill_enable",
]);

export const actionSourceTypeSchema = z.enum(["voice", "brain", "daily", "manual", "subagent", "connector"]);
export const actionProposalStatusSchema = z.enum(["proposed", "approved", "rejected", "executed", "failed", "expired"]);
export const actionDecisionSchema = z.enum(["approved", "rejected"]);
export const actionRiskLevelSchema = z.enum(["low", "medium", "high"]);

export const createActionProposalSchema = z.object({
  sessionId: z.string().uuid().nullable().optional(),
  sourceType: actionSourceTypeSchema.default("manual"),
  actionType: actionTypeSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const actionDecisionBodySchema = z.object({
  reason: z.string().nullable().optional(),
});

export type ActionType = z.infer<typeof actionTypeSchema>;
export type ActionSourceType = z.infer<typeof actionSourceTypeSchema>;
export type CreateActionProposalInput = z.infer<typeof createActionProposalSchema>;

export interface ActionPolicyDecision {
  allowed: boolean;
  requiresApproval: boolean;
  riskLevel: "low" | "medium" | "high";
  reason: string;
  external: boolean;
}

export class ActionPolicyError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
