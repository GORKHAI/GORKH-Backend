import type { SkillDraft } from "./types.js";
import { isSkillSafe } from "./learner.js";

export function evaluateSkillDraft(draft: SkillDraft): { safe: boolean; reason: string } {
  if (!isSkillSafe(draft)) return { safe: false, reason: "Skill requests a disabled or high-risk autonomous action." };
  return { safe: true, reason: "Reusable workflow template only; approval still required before enablement." };
}
