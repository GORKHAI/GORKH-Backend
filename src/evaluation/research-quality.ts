import { db } from "../db/client.js";
import { evaluationEvents } from "../db/schema.js";
import { evaluateResearchAnswer } from "../research/answer-evaluator.js";
import type { ResearchDomain } from "../research/source-policy.js";
import type { ResearchAnswer, SearchResult } from "../research/types.js";
import type { EvaluationResult } from "./types.js";

export function evaluateResearchAnswerQuality(args: {
  query: string;
  answer: ResearchAnswer;
  sources: SearchResult[];
  domain?: ResearchDomain;
  targetId?: string | null;
}): EvaluationResult {
  const evaluation = evaluateResearchAnswer(args);
  return {
    targetType: "research_answer",
    targetId: args.targetId ?? null,
    evaluator: "research_quality_v0",
    score: evaluation.score,
    status: evaluation.status,
    metrics: evaluation.metrics,
    findings: evaluation.findings,
  };
}

export async function persistEvaluation(args: {
  userId?: string | null;
  sessionId?: string | null;
  result: EvaluationResult;
}): Promise<void> {
  await db.insert(evaluationEvents).values({
    userId: args.userId ?? null,
    sessionId: args.sessionId ?? null,
    targetType: args.result.targetType,
    targetId: args.result.targetId ?? null,
    evaluator: args.result.evaluator,
    score: args.result.score,
    status: args.result.status,
    metrics: args.result.metrics,
    findings: args.result.findings,
  });
}
