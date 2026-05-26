import type { ActionType } from "./types.js";
import { classifyActionRisk, isExternalConnectorAction } from "./risk-classifier.js";
import type { ActionPolicyDecision } from "./types.js";

const disabledActionPatterns = [
  /send\s+(it|this|the\s+(email|message))\b/i,
  /send\b.{0,40}\bwithout\s+approval\b/i,
  /submit\s+(form|application|claim|request)\b/i,
  /payment/i,
  /purchase/i,
  /browser_login/i,
  /login/i,
  /execute_code/i,
  /shell/i,
  /hidden_recording/i,
];

export function evaluateActionPolicy(input: { actionType: ActionType; payload?: Record<string, unknown> }): ActionPolicyDecision {
  const payload = input.payload ?? {};
  const payloadText = collectPolicyRelevantText(payload).join(" ");
  if (disabledActionPatterns.some((pattern) => pattern.test(payloadText))) {
    return {
      allowed: false,
      requiresApproval: true,
      riskLevel: "high",
      external: true,
      reason: "Payload requests a disabled dangerous capability.",
    };
  }
  const riskLevel = classifyActionRisk(input.actionType, payload);
  return {
    allowed: true,
    requiresApproval: true,
    riskLevel,
    external: isExternalConnectorAction(input.actionType),
    reason: "Action proposal can be reviewed by the user. Execution remains policy-gated.",
  };
}

function collectPolicyRelevantText(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => collectPolicyRelevantText(item));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => {
    if (/disabled|notConfigured|connectorRequired/i.test(key)) return [];
    return collectPolicyRelevantText(nested);
  });
}

export function isSafeInternalExecutable(actionType: ActionType): boolean {
  return actionType === "propose_reminder" || actionType === "create_task_from_commitment" || actionType === "research_watchlist_create" || actionType === "profile_fact_confirm" || actionType === "skill_enable";
}
