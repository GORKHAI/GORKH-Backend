import type { InternalType } from "../db/schema.js";

export type TriggerType =
  | "financial_term"
  | "money_or_percent"
  | "question_to_user"
  | "commitment"
  | "known_subject"
  | "decision"
  | "medical_term"
  | "medication"
  | "test_result"
  | "follow_up"
  | "legal_term"
  | "deadline"
  | "vague_commitment"
  | "risk_phrase";

export interface TriggerEvent {
  type: TriggerType;
  match: string;
  priority: number;
  reason: string;
  subject?: string;
}

const FINANCIAL_TERMS: Array<{ re: RegExp; reason: string; priority?: number }> = [
  { re: /\bAPR\b/i, reason: "APR mentioned; clarify APR, fees, and total cost", priority: 3 },
  { re: /\bnominal rate\b/i, reason: "Nominal rate mentioned; ask for the APR" },
  { re: /\b(interest rate|interest)\b/i, reason: "Interest discussed; pin down fixed versus variable" },
  { re: /\bfixed[- ]?rate\b/i, reason: "Fixed rate mentioned; confirm fixed period length" },
  { re: /\bvariable[- ]?rate\b/i, reason: "Variable rate mentioned; ask cap and reset frequency" },
  { re: /\b(prepayment|early repayment).{0,24}(penalty|fee|charge)?\b/i, reason: "Early repayment terms need exact cost" },
  { re: /\b(origination|arrangement|processing|admin(istration)?) fee\b/i, reason: "A fee was named; ask for the full written schedule" },
  { re: /\bhidden (fee|cost|charge)\b/i, reason: "Possible undisclosed costs; request all fees" },
  { re: /\binsurance\b/i, reason: "Insurance mentioned; ask if mandatory and what it costs" },
  { re: /\b(total|overall) (repayment|cost|amount)\b/i, reason: "Total repayment referenced; confirm full amount" },
  { re: /\brepayment schedule\b/i, reason: "Repayment schedule mentioned; get the written schedule" },
  { re: /\bsign(ature|ing)?\b/i, reason: "Signing raised; review written terms first", priority: 3 },
];

const MONEY_OR_PERCENT = /(\b\d{1,3}([.,]\d+)?\s?(%|percent)|[€$£]\s?\d[\d.,]*|\b\d[\d.,]*\s?(euros?|dollars?|usd|eur|gbp|k\b))/i;
const QUESTION_TO_USER = /(\?\s*$)|(\b(can|could|would|will|do|are|have)\s+you\b)|(\bwhat('?s| is| are| do you)\b)/i;
const COMMITMENT = /\b(i'?ll|i will|we'?ll|we will|i can|i'?m going to|let me|i'?ll send|send you|get (it|that) to you)\b/i;
const VAGUE_COMMITMENT = /\b(soon|later|asap|sometime|next week|circle back|follow up)\b/i;
const DEADLINE = /\b((by|before|on)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|end of (day|week|month)|eod|eow|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2})\b/i;
const DECISION = /\b(agreed|we (decided|agreed)|we'?ll go with|let'?s (go with|do|move forward)|the plan is|finali[sz]ed|approved)\b/i;
const MEDICAL: Array<{ type: TriggerType; re: RegExp; reason: string; priority: number }> = [
  { type: "medication", re: /\b(medication|medicine|prescription|dose|dosage|side effects?|antibiotic|insulin|tablet)\b/i, reason: "Medication discussed; confirm instructions and side effects", priority: 3 },
  { type: "test_result", re: /\b(blood test|test results?|lab results?|scan|x[- ]?ray|mri|ct scan|cholesterol|a1c)\b/i, reason: "Test result discussed; ask what it means and next steps", priority: 3 },
  { type: "follow_up", re: /\b(follow[- ]?up|referral|next appointment|come back|review in)\b/i, reason: "Follow-up discussed; confirm timing and responsibility", priority: 2 },
  { type: "medical_term", re: /\b(symptoms?|diagnosis|condition|risk|normal range|abnormal|treatment)\b/i, reason: "Medical term discussed; ask for plain-language explanation", priority: 2 },
];
const LEGAL_TERM = /\b(contract|clause|liability|settlement|lawsuit|claim|court|counsel|attorney|lawyer|dispute)\b/i;
const RISK_PHRASE = /\b(urgent|immediately|limited time|must sign|no choice|confidential|off the record|non[- ]?refundable)\b/i;

export function classifySegment(
  segment: { speaker: string; text: string },
  internalType: InternalType,
  knownSubjects: string[] = [],
): TriggerEvent[] {
  const events: TriggerEvent[] = [];
  const text = segment.text;
  const fromOther = segment.speaker !== "me";

  if (["bank_loan", "negotiation", "sales_call", "legal_consultation"].includes(internalType)) {
    for (const term of FINANCIAL_TERMS) {
      const m = term.re.exec(text);
      if (m) events.push({ type: "financial_term", match: m[0], priority: term.priority ?? 2, reason: term.reason });
    }
    const money = MONEY_OR_PERCENT.exec(text);
    if (money) {
      events.push({
        type: "money_or_percent",
        match: money[0].trim(),
        priority: internalType === "bank_loan" ? 2 : 1,
        reason: `A figure was stated (${money[0].trim()}); confirm what it covers`,
      });
    }
  }

  if (internalType === "doctor_visit") {
    for (const term of MEDICAL) {
      const m = term.re.exec(text);
      if (m) events.push({ type: term.type, match: m[0], priority: term.priority, reason: term.reason });
    }
  }

  if (internalType === "legal_consultation") {
    const legal = LEGAL_TERM.exec(text);
    if (legal) events.push({ type: "legal_term", match: legal[0], priority: 3, reason: "Legal term discussed; ask counsel to clarify options and risks" });
  }

  const risk = RISK_PHRASE.exec(text);
  if (risk) events.push({ type: "risk_phrase", match: risk[0], priority: 3, reason: "Pressure or risk language appeared; slow down and verify" });

  if (fromOther) {
    const q = QUESTION_TO_USER.exec(text);
    if (q) events.push({ type: "question_to_user", match: q[0].trim(), priority: 2, reason: "You were asked something; pause before answering" });
  }

  if (["business_meeting", "negotiation", "sales_call", "general"].includes(internalType)) {
    const c = COMMITMENT.exec(text);
    if (c) events.push({ type: "commitment", match: c[0].trim(), priority: 2, reason: "A commitment was made; capture owner and next step" });
    const vague = VAGUE_COMMITMENT.exec(text);
    if (vague) events.push({ type: "vague_commitment", match: vague[0].trim(), priority: 2, reason: "A commitment or timeline is vague; ask for specifics" });
    const deadline = DEADLINE.exec(text);
    if (deadline) events.push({ type: "deadline", match: deadline[0].trim(), priority: 2, reason: "A deadline was stated; confirm owner and date" });
    const decision = DECISION.exec(text);
    if (decision) events.push({ type: "decision", match: decision[0].trim(), priority: 2, reason: "A decision was stated; confirm it clearly" });
  }

  for (const subject of knownSubjects) {
    if (!subject) continue;
    const m = new RegExp(`\\b${escapeRegExp(subject)}\\b`, "i").exec(text);
    if (m) events.push({ type: "known_subject", match: m[0], subject, priority: 3, reason: `"${subject}" came up; prior context exists` });
  }

  return events;
}

export function maxPriority(events: TriggerEvent[]): number {
  return events.reduce((acc, event) => Math.max(acc, event.priority), 0);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
