import type { InternalType } from "../db/schema.js";
import type { TriggerEvent } from "../trigger/classifier.js";

export interface Cue {
  spokenCue: string;
  visualCue: string;
  kind: "ask" | "caution" | "note" | "action";
  urgency: "low" | "medium" | "high";
  confidence: number;
  delivery: "earbud" | "screen" | "haptic" | "silent";
}

export interface CueDecision {
  key: string;
  cue: Cue;
}

type Rule = {
  key: string;
  re: RegExp;
  cue: Cue;
};

const rules: Record<InternalType, Rule[]> = {
  bank_loan: [
    rule("apr", /\bapr\b/i, "Ask APR details.", "Ask whether the quoted rate is APR, what fees it includes, and whether it can change.", "ask", "high"),
    rule("fee", /\b(fee|charge|cost)\b/i, "Ask full fee schedule.", "Ask for the full fee schedule in writing, including mandatory and optional charges.", "ask", "high"),
    rule("sign", /\bsign(ature|ing)?\b/i, "Do not sign yet.", "Pause before signing. Ask to review the full written terms and total repayment first.", "caution", "high"),
    rule("total", /\b(total|overall) (repayment|cost|amount)\b/i, "Ask total repayment.", "Ask for the full repayment schedule and total cost over the life of the loan.", "ask", "high"),
    rule("fixed-variable", /\b(fixed|variable)\b/i, "Ask fixed or variable.", "Clarify whether the rate is fixed or variable, for how long, and when it can change.", "ask", "high"),
    rule("insurance", /\binsurance\b/i, "Ask if mandatory.", "Ask whether insurance is mandatory, what it costs, and whether you can choose another provider.", "ask", "high"),
  ],
  doctor_visit: [
    rule("medication", /\b(medication|medicine|prescription|dose|side effects?)\b/i, "Ask side effects.", "Ask what the medication is for, how to take it, side effects, and when to seek help.", "ask", "high"),
    rule("test-result", /\b(test results?|blood test|lab results?|scan|x[- ]?ray|mri|ct scan)\b/i, "Ask what it means.", "Ask the clinician to explain the result in plain language and what happens next.", "ask", "high"),
    rule("symptoms", /\bsymptoms?\b/i, "Ask warning signs.", "Ask which symptoms are expected, which are warning signs, and who to contact.", "ask", "high"),
    rule("follow-up", /\bfollow[- ]?up|next appointment|referral\b/i, "Confirm next step.", "Confirm the next step, who owns it, and the exact follow-up timing.", "action", "medium"),
  ],
  business_meeting: [
    rule("commitment", /\b(i'?ll|we'?ll|i will|we will|send you|get that to you|owner)\b/i, "Capture owner and deadline.", "Capture who owns the action item and the exact deadline.", "action", "medium", "screen"),
    rule("decision", /\b(decided|agreed|approved|the plan is|move forward)\b/i, "Confirm the decision.", "Confirm the decision, owner, and next step before the topic changes.", "action", "medium", "screen"),
    rule("vague", /\b(soon|later|asap|next week|circle back)\b/i, "Ask exact date.", "Ask for an exact date or event that defines the deadline.", "ask", "medium", "screen"),
  ],
  negotiation: [
    rule("price", /\b(price|discount|salary|rent|quote|offer)\b/i, "Clarify the exact term.", "Clarify the exact number, what is included, and whether the term is in writing.", "ask", "high"),
    rule("pressure", /\b(must sign|today only|no choice|immediately)\b/i, "Slow down.", "Pause and ask for time to review the terms before agreeing.", "caution", "high"),
  ],
  sales_call: [
    rule("pricing", /\b(price|pricing|budget|quote)\b/i, "Clarify scope first.", "Clarify scope, decision process, and success criteria before committing on price.", "ask", "medium", "screen"),
    rule("next-step", /\b(follow up|next step|send you|demo)\b/i, "Confirm next step.", "Confirm owner, deadline, and the next meeting or deliverable.", "action", "medium", "screen"),
  ],
  job_interview: [
    rule("compensation", /\b(salary|compensation|offer|benefits)\b/i, "Ask process and range.", "Ask about the compensation range, process, and next steps professionally.", "ask", "medium", "screen"),
  ],
  legal_consultation: [
    rule("legal-term", /\b(contract|clause|liability|settlement|claim|court)\b/i, "Ask legal options.", "Ask counsel to explain your options, risks, costs, and deadlines in plain language.", "ask", "high"),
    rule("sign", /\bsign(ature|ing)?\b/i, "Do not sign yet.", "Ask your counsel what signing would mean and whether you need more time.", "caution", "high"),
  ],
  personal_conversation: [
    rule("escalation", /\b(always|never|you made me|your fault|whatever)\b/i, "Slow the pace.", "Use a calm clarifying question and avoid blame or mind-reading.", "caution", "medium", "screen"),
  ],
  general: [
    rule("decision", /\b(decided|agreed|approved|the plan is)\b/i, "Confirm the decision.", "Confirm the decision and next step.", "action", "medium", "screen"),
    rule("commitment", /\b(i'?ll|we'?ll|i will|we will|follow up)\b/i, "Capture the follow-up.", "Capture owner and timing for the follow-up.", "action", "medium", "screen"),
  ],
};

export function generateFastCue(input: {
  internalType: InternalType;
  text: string;
  triggers: TriggerEvent[];
}): CueDecision | null {
  const candidates = [...rules[input.internalType], ...rules.general];
  for (const candidate of candidates) {
    if (!candidate.re.test(input.text)) continue;
    return {
      key: `${input.internalType}:${candidate.key}`,
      cue: enforceCue(candidate.cue),
    };
  }
  const highest = input.triggers.find((t) => t.priority >= 3);
  if (!highest) return null;
  return {
    key: `${input.internalType}:${highest.type}`,
    cue: enforceCue({
      spokenCue: "Pause and verify.",
      visualCue: highest.reason,
      kind: "caution",
      urgency: "high",
      confidence: 0.75,
      delivery: ["bank_loan", "doctor_visit", "legal_consultation", "negotiation"].includes(input.internalType) ? "earbud" : "screen",
    }),
  };
}

function rule(
  key: string,
  re: RegExp,
  spokenCue: string,
  visualCue: string,
  kind: Cue["kind"],
  urgency: Cue["urgency"],
  delivery: Cue["delivery"] = "earbud",
): Rule {
  return { key, re, cue: { spokenCue, visualCue, kind, urgency, confidence: 0.9, delivery } };
}

export function enforceCue(cue: Cue): Cue {
  return {
    ...cue,
    spokenCue: limitWords(cue.spokenCue, 8),
    visualCue: cue.visualCue.slice(0, 180),
    confidence: Math.max(0, Math.min(1, cue.confidence)),
  };
}

function limitWords(value: string, maxWords: number): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? value.trim() : words.slice(0, maxWords).join(" ");
}
