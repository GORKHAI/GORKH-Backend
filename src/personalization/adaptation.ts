import type { HumanContextSummary } from "../human/types.js";
import type { AdaptationHints } from "./types.js";

export function adaptationHintsFromContext(context: HumanContextSummary | null): AdaptationHints {
  const preference = String(context?.communicationPreferences?.preference ?? context?.assistantPreferences?.preference ?? "");
  return {
    brevity: /\b(short|concise|brief|direct)\b/i.test(preference) ? "short" : "normal",
    domainLanguage: context?.occupation ?? null,
    stressSupportOptIn: context?.stressSupportOptIn === true,
  };
}

export function adaptTextToUser(text: string, context: HumanContextSummary | null): string {
  const hints = adaptationHintsFromContext(context);
  if (hints.brevity === "short" && text.length > 500) return `${text.slice(0, 497)}...`;
  return text;
}
