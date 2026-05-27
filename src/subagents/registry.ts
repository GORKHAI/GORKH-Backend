import type { SubagentKind, SubagentWorker } from "./types.js";
import { runMemorySubagent } from "./workers/memory-subagent.js";
import { runCommitmentSubagent } from "./workers/commitment-subagent.js";
import { runDailyBriefSubagent } from "./workers/daily-brief-subagent.js";
import { runFollowupSubagent } from "./workers/followup-subagent.js";
import { runMeetingPackSubagent } from "./workers/meeting-pack-subagent.js";
import { runProfileContextSubagent } from "./workers/profile-context-subagent.js";
import { runResearchSubagent } from "./workers/research-subagent.js";
import { runSkillSubagent } from "./workers/skill-subagent.js";
import { runSourceVerifierSubagent } from "./workers/source-verifier-subagent.js";
import { runStressSupportSubagent } from "./workers/stress-support-subagent.js";
import { runWeeklyReviewSubagent } from "./workers/weekly-review-subagent.js";

const workers: Record<SubagentKind, SubagentWorker> = {
  research: runResearchSubagent,
  source_verifier: runSourceVerifierSubagent,
  memory_lookup: runMemorySubagent,
  skill_matcher: runSkillSubagent,
  stress_support: runStressSupportSubagent,
  profile_context: runProfileContextSubagent,
  commitment: runCommitmentSubagent,
  daily_brief: runDailyBriefSubagent,
  meeting_pack: runMeetingPackSubagent,
  followup: runFollowupSubagent,
  daily_prioritizer: runDailyBriefSubagent,
  commitment_review: runCommitmentSubagent,
  followup_review: runFollowupSubagent,
  weekly_review: runWeeklyReviewSubagent,
};

export function getSubagentWorker(kind: SubagentKind): SubagentWorker {
  return workers[kind];
}

export function listSubagentKinds(): SubagentKind[] {
  return Object.keys(workers) as SubagentKind[];
}
