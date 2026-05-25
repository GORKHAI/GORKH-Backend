import type { SessionMode } from "../db/schema.js";

export type TriggerType =
  | "financial_term" // APR, fixed/variable, prepayment penalty, ...
  | "money_or_percent" // a spoken number that looks like an amount or rate
  | "question_to_user" // the other party asked you something
  | "commitment" // you (or they) committed to do something
  | "known_subject" // a name/topic the user already has memory about
  | "decision"; // a decision was stated

export interface TriggerEvent {
  type: TriggerType;
  /** The substring of the segment that fired the trigger. */
  match: string;
  /** 1 (low) .. 3 (high) — used to decide whether to spend an LLM call. */
  priority: number;
  /** Short human-readable reason, surfaced to the suggestion prompt. */
  reason: string;
  /** For known_subject triggers: the matched subject string to retrieve memory for. */
  subject?: string;
}

/** Financial / negotiation vocabulary that warrants a heads-up. */
const FINANCIAL_TERMS: Array<{ re: RegExp; reason: string }> = [
  { re: /\bAPR\b/i, reason: "APR mentioned — confirm it's APR vs nominal rate" },
  { re: /\bnominal rate\b/i, reason: "Nominal rate mentioned — ask for the APR" },
  { re: /\b(interest rate|interest)\b/i, reason: "Interest discussed — pin down fixed vs variable" },
  { re: /\bfixed[- ]?rate\b/i, reason: "Fixed rate mentioned — confirm the fixed period length" },
  { re: /\bvariable[- ]?rate\b/i, reason: "Variable rate — ask the cap and reset frequency" },
  { re: /\bprepayment (penalty|fee|charge)\b/i, reason: "Prepayment penalty — ask the exact cost to repay early" },
  { re: /\bearly repayment\b/i, reason: "Early repayment raised — confirm any penalty" },
  { re: /\b(origination|arrangement|processing|admin(istration)?) fee\b/i, reason: "A fee was named — ask for it in writing" },
  { re: /\bhidden (fee|cost|charge)/i, reason: "Possible undisclosed costs — request the full fee schedule" },
  { re: /\binsurance\b/i, reason: "Insurance mentioned — ask if it's mandatory and its cost" },
  { re: /\bcollateral\b/i, reason: "Collateral raised — clarify exactly what is pledged" },
  { re: /\bballoon payment\b/i, reason: "Balloon payment — confirm the final lump-sum amount" },
  { re: /\b(total|overall) (repayment|cost|amount)\b/i, reason: "Total repayment referenced — get the full figure and schedule" },
  { re: /\brepayment schedule\b/i, reason: "Ask for the complete written repayment schedule" },
  { re: /\bsign\b/i, reason: "Signing raised — do not sign before you have written terms" },
  { re: /\bnon[- ]?refundable\b/i, reason: "Non-refundable term — confirm exactly what is non-refundable" },
];

// e.g. "4.2%", "3,5 %", "€12,000", "$1500", "1500 euros", "12k"
const MONEY_OR_PERCENT =
  /(\b\d{1,3}([.,]\d+)?\s?%|[€$£]\s?\d[\d.,]*|\b\d[\d.,]*\s?(euros?|dollars?|usd|eur|gbp|k\b))/i;

// Question directed outward: ends with "?", or imperative-ish asks aimed at "you".
const QUESTION_TO_USER =
  /(\?\s*$)|(\b(can|could|would|will|do|are|have)\s+you\b)|(\bwhat('?s| is| are| do you)\b)/i;

// Commitment language from either party.
const COMMITMENT =
  /\b(i'?ll|i will|we'?ll|we will|i can|i'?m going to|let me|i'?ll send|send you|get (it|that) to you|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|end of (day|week|month)|eod|eow))\b/i;

const DECISION =
  /\b(agreed|we (decided|agreed)|we'?(ll|\s?will|\s?re|\s?are)\s+go(ing)?\s+with|let'?s (go with|do|move forward)|the plan is|final(ised|ized)|approved)\b/i;

/**
 * Inspect one final transcript segment and return any trigger events.
 *
 * `knownSubjects` is the set of subjects the user already has memory about
 * (e.g. people's names, project names). When one is mentioned we flag it so
 * the suggestion layer can retrieve the relevant memory before responding.
 */
export function classifySegment(
  segment: { speaker: string; text: string },
  mode: SessionMode,
  knownSubjects: string[] = [],
): TriggerEvent[] {
  const events: TriggerEvent[] = [];
  const text = segment.text;
  const fromOther = segment.speaker !== "me";

  // Financial vocabulary — highest value in bank/negotiation modes.
  if (mode === "bank" || mode === "negotiation") {
    for (const { re, reason } of FINANCIAL_TERMS) {
      const m = re.exec(text);
      if (m) {
        events.push({
          type: "financial_term",
          match: m[0],
          priority: 3,
          reason,
        });
      }
    }
    const moneyM = MONEY_OR_PERCENT.exec(text);
    if (moneyM) {
      events.push({
        type: "money_or_percent",
        match: moneyM[0].trim(),
        priority: 2,
        reason: `A figure was stated (${moneyM[0].trim()}) — make sure you understand what it covers`,
      });
    }
  }

  // A question aimed at the user — relevant in every mode, but only when it
  // comes from the other party.
  if (fromOther) {
    const qM = QUESTION_TO_USER.exec(text);
    if (qM) {
      events.push({
        type: "question_to_user",
        match: qM[0].trim(),
        priority: 2,
        reason: "You were just asked something — you may want help answering",
      });
    }
  }

  // Commitments and decisions matter in meeting mode for action-item capture.
  if (mode === "meeting" || mode === "negotiation") {
    const cM = COMMITMENT.exec(text);
    if (cM) {
      events.push({
        type: "commitment",
        match: cM[0].trim(),
        priority: 2,
        reason: "A commitment was made — capture it as a follow-up",
      });
    }
    const dM = DECISION.exec(text);
    if (dM) {
      events.push({
        type: "decision",
        match: dM[0].trim(),
        priority: 2,
        reason: "A decision was stated — record it",
      });
    }
  }

  // Known subjects from memory — any mode.
  for (const subject of knownSubjects) {
    if (!subject) continue;
    const re = new RegExp(`\\b${escapeRegExp(subject)}\\b`, "i");
    const m = re.exec(text);
    if (m) {
      events.push({
        type: "known_subject",
        match: m[0],
        subject,
        priority: 3,
        reason: `"${subject}" came up — you have prior context on this`,
      });
    }
  }

  return events;
}

/** Highest priority among a set of events; 0 if none. */
export function maxPriority(events: TriggerEvent[]): number {
  return events.reduce((acc, e) => Math.max(acc, e.priority), 0);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
