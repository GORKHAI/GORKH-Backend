import { detectResearchNeed } from "../research/need-detector.js";

export function routeBrainInput(text: string) {
  const researchNeed = detectResearchNeed({ text });
  if (researchNeed.needsResearch) return { route: "research" as const, researchNeed };
  if (/\b(stress|anxious|panic|overwhelmed|can't breathe|cannot breathe|self[- ]?harm|suicide)\b/i.test(text)) {
    return { route: "stress" as const, researchNeed };
  }
  return { route: "playbook" as const, researchNeed };
}
