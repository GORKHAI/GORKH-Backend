import type { ResearchNeedDecision } from "../research/types.js";
import type { RememberMode } from "../human/profile-mutation-gate.js";

export interface BrainQueryInput {
  userId: string;
  text: string;
  situationBriefId?: string | null;
  sessionId?: string | null;
  allowResearch?: boolean;
  allowProfileContext?: boolean;
  allowProfileMutation?: boolean;
  rememberMode?: RememberMode;
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
