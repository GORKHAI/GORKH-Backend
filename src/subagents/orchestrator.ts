import { createSubagentTask } from "./scheduler.js";
import type { CreateSubagentTaskInput, SubagentProgress, SubagentTask } from "./types.js";

export async function startSubagentTask(args: {
  userId: string;
  input: CreateSubagentTaskInput;
  onProgress?: (event: SubagentProgress) => void;
}): Promise<SubagentTask> {
  return createSubagentTask(args.userId, args.input, args.onProgress);
}

export async function startResearchSubagent(args: {
  userId: string;
  sessionId?: string | null;
  situationBriefId?: string | null;
  query: string;
  internalType?: string;
  trigger?: "user_request" | "research_needed" | "voice_session_side_channel";
  liveDelivery?: "silent" | "screen_only" | "main_agent_summary";
  priority?: "low" | "normal" | "high" | "urgent";
  onProgress?: (event: SubagentProgress) => void;
}): Promise<SubagentTask> {
  return createSubagentTask(
    args.userId,
    {
      kind: "research",
      trigger: args.trigger ?? "research_needed",
      priority: args.priority ?? "normal",
      sessionId: args.sessionId ?? null,
      situationBriefId: args.situationBriefId ?? null,
      input: {
        query: args.query,
        intent: args.internalType,
        internalType: args.internalType,
      },
      policy: {
        allowResearch: true,
        allowProfileContext: false,
        allowMemory: false,
        allowStressSupport: false,
        allowUserFacingReport: true,
        liveDelivery: args.liveDelivery ?? "screen_only",
      },
    },
    args.onProgress,
  );
}
