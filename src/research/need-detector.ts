import type { ResearchNeedDecision } from "./types.js";

const freshTerms = /\b(current|latest|recent|today|this week|now|up to date|202[0-9])\b/i;
const sourceTerms = /\b(check online|search|verify|find official source|source|citation|what documents are required)\b/i;
const highStakesFacts = /\b(rate|rates|price|prices|law|legal|regulation|policy|tax|medical|mortgage|APR|bank requirement|background|company|person)\b/i;

export function detectResearchNeed(input: {
  text: string;
  internalType?: string;
  situationDescription?: string;
  livePolicy?: "conversation_agent" | "whisper_copilot";
}): ResearchNeedDecision {
  const text = `${input.text} ${input.situationDescription ?? ""}`.trim();
  if (/\b(ask total repayment|confirm deadline|get it in writing|summary|summarize|remember)\b/i.test(input.text) && !sourceTerms.test(text)) {
    return { needsResearch: false, urgency: "none", researchKind: "no_research", suggestedQuery: null, reason: "covered by deterministic playbook or memory", allowedDuringLive: false };
  }
  if (sourceTerms.test(text) || freshTerms.test(text) || highStakesFacts.test(text)) {
    const urgency = /\b(today|now|urgent|before my meeting)\b/i.test(text) ? "high" : freshTerms.test(text) ? "medium" : "low";
    const kind = sourceTerms.test(text) || /\bofficial|verify|documents\b/i.test(text) ? "source_verification" : "quick_lookup";
    return {
      needsResearch: true,
      urgency,
      researchKind: kind,
      suggestedQuery: normalizeQuery(input.text),
      reason: "fresh or externally verifiable factual information requested",
      allowedDuringLive: input.livePolicy !== "whisper_copilot",
    };
  }
  return { needsResearch: false, urgency: "none", researchKind: "no_research", suggestedQuery: null, reason: "no freshness or external verification need", allowedDuringLive: false };
}

function normalizeQuery(text: string): string {
  return text.replace(/\b(check online|search|verify|find official source)\b/gi, "").replace(/\s+/g, " ").trim();
}
