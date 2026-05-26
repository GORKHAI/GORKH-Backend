import type { SkillDraft } from "./types.js";

const dangerousStepPatterns = [
  /\bexecute_code\b/i,
  /\bshell\b/i,
  /\bsubmit[_ -]?form\b/i,
  /\blogin[_ -]?browser\b/i,
  /\bpayment\b/i,
  /\bpurchase\b/i,
  /\bsend[_ -]?message[_ -]?without[_ -]?approval\b/i,
  /\bhidden[_ -]?recording\b/i,
  /\bdiagnose[_ -]?medical[_ -]?condition\b/i,
  /\bdiagnos(?:e|is|tic)\b/i,
  /\bmanipulat(?:e|ion)\b/i,
  /\bfinal[_ -]?financial[_ -]?decision\b/i,
  /\bfinal[_ -]?legal[_ -]?decision\b/i,
  /\bmedical[_ -]?treatment\b/i,
  /\btreatment recommendation\b/i,
];

const forbidden = new RegExp(dangerousStepPatterns.map((pattern) => pattern.source).join("|"), "i");

export function proposeSkillFromReflection(input: { text: string; internalType?: string }): SkillDraft | null {
  if (forbidden.test(input.text)) return null;
  if (input.internalType === "bank_loan" || /\b(bank|loan|mortgage|APR)\b/i.test(input.text)) {
    return {
      name: "bank_loan_prebrief",
      description: "Reusable preparation workflow for bank loan or mortgage meetings.",
      triggerPattern: "loan|mortgage|APR|bank meeting",
      riskLevel: "medium",
      steps: [
        "create situation brief",
        "ask for country, loan amount, and term",
        "search official consumer credit sources if research provider is configured",
        "produce prep questions about APR, fees, repayment, fixed/variable terms, and written documents",
        "enable whisper_copilot tactical cues",
        "never choose loan terms or a final decision for the user",
      ],
    };
  }
  return null;
}

export function isSkillSafe(draft: SkillDraft): boolean {
  return validateSkillManifest(draft).ok;
}

export function validateSkillManifest(draft: SkillDraft): { ok: true } | { ok: false; reason: string; dangerousStep: string } {
  const values = [draft.name, draft.description, draft.triggerPattern, ...draft.steps];
  for (const value of values) {
    const dangerous = dangerousStepPatterns.find((pattern) => pattern.test(value));
    if (dangerous) return { ok: false, reason: "dangerous_skill_step", dangerousStep: value };
  }
  return { ok: true };
}
