import { validateResearchCitations } from "./citations.js";
import { classifyResearchDomain, sourcePolicyForDomain, type ResearchDomain } from "./source-policy.js";
import type { ResearchAnswer, SearchResult } from "./types.js";

export interface ResearchAnswerEvaluation {
  score: number;
  status: "passed" | "warning" | "failed";
  metrics: Record<string, unknown>;
  findings: string[];
}

export function evaluateResearchAnswer(args: {
  query: string;
  answer: ResearchAnswer;
  sources: SearchResult[];
  domain?: ResearchDomain;
}): ResearchAnswerEvaluation {
  const domain = args.domain ?? classifyResearchDomain({ text: args.query });
  const policy = sourcePolicyForDomain(domain);
  const citationValidation = validateResearchCitations({ answer: args.answer, sources: args.sources, domain });
  const findings = [...citationValidation.quality.findings];
  const answerText = args.answer.answer.toLowerCase();
  if (policy.highStakes && !/(source|sources|indicate|suggest|information|ask|verify|professional|qualified)/i.test(args.answer.answer)) {
    findings.push("high_stakes_answer_overclaims_certainty");
  }
  if (policy.highStakes && /\b(you should|must|definitely|diagnosis is|sign it|do not need a lawyer)\b/i.test(args.answer.answer)) {
    findings.push("unsupported_high_stakes_directive");
  }
  if (answerText.length > 1800) findings.push("answer_too_long");
  const score = Math.max(0, Math.min(1, citationValidation.quality.overallCitationScore - findings.length * 0.08));
  return {
    score,
    status: findings.some((finding) => finding.includes("not_source_backed") || finding.includes("unsupported_high_stakes")) ? "failed" : findings.length > 0 ? "warning" : "passed",
    metrics: {
      domain,
      citationQuality: citationValidation.quality,
      answerLength: args.answer.answer.length,
      highStakes: policy.highStakes,
    },
    findings,
  };
}
