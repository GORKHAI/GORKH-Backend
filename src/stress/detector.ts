import type { StressDecision } from "./types.js";

const crisis = /\b(kill myself|suicide|self[- ]?harm|end my life|hurt myself|immediate danger)\b/i;
const breathing = /\b(can't breathe|cannot breathe|hard to breathe)\b/i;
const overwhelmed = /\b(overwhelmed|panic|panicking|freaking out)\b/i;
const selfReport = /\b(i am stressed|i'm stressed|i feel anxious|i am anxious|i'm anxious|i feel stressed)\b/i;

export function detectStressSignal(text: string): StressDecision {
  if (crisis.test(text)) return { detected: true, signal: "crisis", confidence: 0.95, crisis: true, reason: "self-harm or immediate danger language" };
  if (breathing.test(text)) return { detected: true, signal: "breathing_distress", confidence: 0.85, crisis: false, reason: "breathing distress self-report" };
  if (overwhelmed.test(text)) return { detected: true, signal: "overwhelm", confidence: 0.8, crisis: false, reason: "overwhelm or panic self-report" };
  if (selfReport.test(text)) return { detected: true, signal: "self_report", confidence: 0.75, crisis: false, reason: "stress self-report" };
  return { detected: false, signal: "none", confidence: 0, crisis: false, reason: "no conservative stress signal" };
}

export function isStressSupportRequest(text: string): boolean {
  return detectStressSignal(text).detected || /\b(help me calm|ground me|breathing|take a break|i need a pause)\b/i.test(text);
}
