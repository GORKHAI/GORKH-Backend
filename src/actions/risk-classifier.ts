import type { ActionType } from "./types.js";

export function classifyActionRisk(actionType: ActionType, payload: Record<string, unknown> = {}): "low" | "medium" | "high" {
  if (actionType === "profile_fact_confirm" || actionType === "skill_enable") return "medium";
  if (actionType === "propose_calendar_event") return "medium";
  if (actionType === "draft_email" || actionType === "draft_followup_message") return "medium";
  if (String(payload.sensitivity ?? "").match(/high|sensitive/i)) return "high";
  return "low";
}

export function isExternalConnectorAction(actionType: ActionType): boolean {
  return actionType === "draft_email" || actionType === "draft_followup_message" || actionType === "propose_calendar_event";
}
