export type RememberMode = "off" | "explicit_only" | "session_save" | "always_propose_low_risk";

export interface ProfileMutationDecision {
  allowed: boolean;
  explicit: boolean;
  reason: "disabled" | "explicit_remember" | "session_save" | "always_propose_low_risk" | "not_explicit";
}

const explicitRememberPattern = /\b(?:remember that|remember i|remember my|save this|add to my profile|my preference is|i prefer|call me|i am a|i'm a|my role is|my job is)\b/i;

export function decideProfileMutation(input: { text: string; allowProfileMutation?: boolean; rememberMode?: RememberMode }): ProfileMutationDecision {
  const mode = input.rememberMode ?? "explicit_only";
  const explicit = explicitRememberPattern.test(input.text);
  if (mode === "off" || input.allowProfileMutation === false) return { allowed: false, explicit, reason: "disabled" };
  if (explicit) return { allowed: true, explicit, reason: "explicit_remember" };
  if (mode === "always_propose_low_risk") return { allowed: true, explicit, reason: "always_propose_low_risk" };
  if (mode === "session_save") return { allowed: false, explicit, reason: "session_save" };
  return { allowed: false, explicit, reason: "not_explicit" };
}

export function isExplicitRememberRequest(text: string): boolean {
  return explicitRememberPattern.test(text);
}
