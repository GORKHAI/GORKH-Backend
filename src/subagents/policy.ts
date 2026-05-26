import type { SubagentTask } from "./types.js";

export function evaluateSubagentPolicy(task: Pick<SubagentTask, "kind" | "policy" | "trigger">): { allowed: true } | { allowed: false; reason: string } {
  if (task.kind === "research" || task.kind === "source_verifier") {
    if (!task.policy.allowResearch) return { allowed: false, reason: "research_not_allowed" };
  }
  if ((task.kind === "memory_lookup" || task.kind === "profile_context") && !task.policy.allowMemory && !task.policy.allowProfileContext) {
    return { allowed: false, reason: "memory_or_profile_context_not_allowed" };
  }
  if (task.kind === "stress_support") {
    const explicit = task.trigger === "stress_support_request" || task.trigger === "user_request";
    if (!task.policy.allowStressSupport || !explicit) return { allowed: false, reason: "stress_support_not_allowed" };
  }
  return { allowed: true };
}

export const disabledSubagentCapabilities = [
  "execute_code",
  "shell",
  "submit_form",
  "login_browser",
  "payment",
  "send_message_without_approval",
  "hidden_recording",
  "diagnose_medical_condition",
  "manipulate_person",
  "final_financial_decision",
  "final_legal_decision",
  "private_browser_session",
];
