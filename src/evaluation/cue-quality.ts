import { config } from "../config.js";
import type { EvaluationResult } from "./types.js";

export interface CueQualityInput {
  cueText: string;
  targetId?: string | null;
  transcriptReceivedAt?: number | null;
  cueEmittedAt?: number | null;
  gatewayInstructionAt?: number | null;
  delivery?: string | null;
  source?: "deterministic" | "llm" | "subagent";
}

export function evaluateCueQuality(input: CueQualityInput): EvaluationResult {
  const wordCount = countWords(input.cueText);
  const transcriptToCueMs =
    typeof input.transcriptReceivedAt === "number" && typeof input.cueEmittedAt === "number"
      ? Math.max(0, input.cueEmittedAt - input.transcriptReceivedAt)
      : null;
  const cueToGatewayInstructionMs =
    typeof input.cueEmittedAt === "number" && typeof input.gatewayInstructionAt === "number"
      ? Math.max(0, input.gatewayInstructionAt - input.cueEmittedAt)
      : null;
  const findings: string[] = [];
  if (wordCount > config.VOICE_CUE_MAX_SPOKEN_WORDS) findings.push("spoken_cue_word_limit_exceeded");
  if (transcriptToCueMs !== null && transcriptToCueMs > config.VOICE_CUE_TARGET_LATENCY_MS) findings.push("cue_latency_above_target");
  if (input.delivery === "earbud" && wordCount > config.VOICE_CUE_MAX_SPOKEN_WORDS) findings.push("long_earbud_delivery");
  const score = Math.max(0, Math.min(1, 1 - findings.length * 0.25 - Math.max(0, wordCount - config.VOICE_CUE_MAX_SPOKEN_WORDS) * 0.05));
  return {
    targetType: "cue",
    targetId: input.targetId ?? null,
    evaluator: "cue_quality_v0",
    score,
    status: findings.some((finding) => finding.includes("word_limit")) ? "failed" : findings.length ? "warning" : "passed",
    metrics: {
      wordCount,
      transcriptToCueMs,
      cueToGatewayInstructionMs,
      targetLatencyMs: config.VOICE_CUE_TARGET_LATENCY_MS,
      delivery: input.delivery ?? null,
      source: input.source ?? "deterministic",
    },
    findings,
  };
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
