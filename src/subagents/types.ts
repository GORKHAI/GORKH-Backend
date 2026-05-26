import { z } from "zod";

export const subagentKindSchema = z.enum([
  "research",
  "source_verifier",
  "memory_lookup",
  "skill_matcher",
  "stress_support",
  "profile_context",
  "commitment",
  "daily_brief",
  "meeting_pack",
  "followup",
]);
export const subagentTaskStatusSchema = z.enum(["queued", "running", "completed", "failed", "canceled", "expired", "suppressed"]);
export const subagentRunnerModeSchema = z.enum(["in_process", "db_worker", "disabled"]);
export const subagentPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);
export const subagentTriggerSchema = z.enum([
  "user_request",
  "research_needed",
  "voice_session_side_channel",
  "saved_session_reflection",
  "skill_match",
  "stress_support_request",
  "profile_context_needed",
]);
export const liveDeliverySchema = z.enum(["silent", "screen_only", "main_agent_summary"]);

export const subagentPolicySchema = z.object({
  allowResearch: z.boolean().default(false),
  allowProfileContext: z.boolean().default(false),
  allowMemory: z.boolean().default(false),
  allowStressSupport: z.boolean().default(false),
  allowUserFacingReport: z.boolean().default(false),
  liveDelivery: liveDeliverySchema.default("screen_only"),
});

export const createSubagentTaskSchema = z.object({
  kind: subagentKindSchema,
  trigger: subagentTriggerSchema.default("user_request"),
  priority: subagentPrioritySchema.default("normal"),
  sessionId: z.string().uuid().nullable().optional(),
  situationBriefId: z.string().uuid().nullable().optional(),
  parentTurnId: z.string().nullable().optional(),
  input: z.unknown(),
  policy: subagentPolicySchema,
  timeoutMs: z.number().int().positive().optional(),
  maxAttempts: z.number().int().positive().optional(),
  idempotencyKey: z.string().min(1).nullable().optional(),
  dedupeKey: z.string().min(1).nullable().optional(),
});

export type SubagentKind = z.infer<typeof subagentKindSchema>;
export type SubagentTaskStatus = z.infer<typeof subagentTaskStatusSchema>;
export type SubagentPriority = z.infer<typeof subagentPrioritySchema>;
export type SubagentTrigger = z.infer<typeof subagentTriggerSchema>;
export type SubagentPolicy = z.infer<typeof subagentPolicySchema>;
export type CreateSubagentTaskInput = z.infer<typeof createSubagentTaskSchema>;
export type SubagentRunnerMode = z.infer<typeof subagentRunnerModeSchema>;

export interface SubagentTask {
  id: string;
  userId: string;
  sessionId?: string | null;
  situationBriefId?: string | null;
  parentTurnId?: string | null;
  kind: SubagentKind;
  trigger: SubagentTrigger;
  priority: SubagentPriority;
  input: unknown;
  policy: SubagentPolicy;
  timeoutMs: number;
  attemptCount?: number;
  maxAttempts?: number;
  leaseToken?: string | null;
  createdAt: string;
}

export interface SubagentFinding {
  claim: string;
  confidence: number;
  citations?: Array<{ title: string; url: string; sourceId?: string }>;
  limitation?: string;
}

export interface SubagentReport {
  taskId: string;
  kind: SubagentKind;
  status: "completed" | "failed" | "canceled" | "suppressed";
  title: string;
  summary: string;
  findings: SubagentFinding[];
  recommendedMainAgentMessage?: string;
  safetyNotes: string[];
  providerStatus?: {
    provider: string;
    configured: boolean;
    errorCode?: string;
  };
  createdAt: string;
}

export interface SubagentProgress {
  taskId: string;
  kind: SubagentKind;
  status: string;
  message: string;
}

export interface SubagentNotificationPayload {
  taskId?: string;
  kind?: SubagentKind;
  status?: string;
  message?: string;
  report?: unknown;
  [key: string]: unknown;
}

export interface SubagentWorkerContext {
  signal: AbortSignal;
  emitProgress: (message: string) => Promise<void>;
}

export type SubagentWorker = (task: SubagentTask, context: SubagentWorkerContext) => Promise<SubagentReport>;
