import type { Sensitivity } from "../db/schema.js";

const stressTerms = /\b(stress|stressed|anxious|anxiety|panic|overwhelmed|can't breathe|cannot breathe|trauma|depressed|self[- ]?harm|suicide|kill myself)\b/i;
const medicalTerms = /\b(diagnosis|medication|blood test|symptom|doctor|therapy|therapist|panic attack)\b/i;
const relationshipTerms = /\b(girlfriend|boyfriend|wife|husband|partner|relationship|divorce)\b/i;

export function classifyProfileSensitivity(content: string): Sensitivity {
  if (stressTerms.test(content)) return "sensitive";
  if (medicalTerms.test(content) || relationshipTerms.test(content)) return "high";
  if (/\b(salary|debt|loan amount|legal dispute|lawsuit|tax)\b/i.test(content)) return "medium";
  return "low";
}

export function canAutoConfirmFact(args: {
  source: "explicit_user" | "inferred" | "confirmed" | "imported";
  sensitivity: Sensitivity;
  stressSupportOptIn: boolean;
  autoSaveLowRisk: boolean;
  autoSaveSensitive: boolean;
}): boolean {
  if (args.source !== "explicit_user") return false;
  if (args.sensitivity === "low") return args.autoSaveLowRisk;
  if (args.sensitivity === "sensitive") return args.autoSaveSensitive && args.stressSupportOptIn;
  return false;
}

export function redactSensitivePreview(text: string): string {
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}
