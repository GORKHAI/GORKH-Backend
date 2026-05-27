export type EvaluationTargetType = "research_answer" | "cue" | "assistant_text" | "subagent_report" | "action_proposal" | "daily_brief";
export type EvaluationStatus = "passed" | "warning" | "failed";

export interface EvaluationResult {
  targetType: EvaluationTargetType;
  targetId?: string | null;
  evaluator: string;
  score: number;
  status: EvaluationStatus;
  metrics: Record<string, unknown>;
  findings: string[];
}
