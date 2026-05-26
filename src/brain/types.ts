import type { ResearchNeedDecision } from "../research/types.js";

export interface BrainQueryInput {
  userId: string;
  text: string;
  situationBriefId?: string | null;
  sessionId?: string | null;
  allowResearch?: boolean;
  allowProfileContext?: boolean;
  researchMode?: "inline" | "subagent";
}

export interface BrainQueryResult {
  status?: "answered" | "subagent_started";
  answer: string;
  usedProfileContext: boolean;
  researchNeed: ResearchNeedDecision;
  research?: unknown;
  taskId?: string;
  message?: string;
  auditEventId?: string;
}
