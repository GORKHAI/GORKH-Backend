import type { PostSessionAudioAnalysisPlan } from "./types.js";

export interface BuildPostSessionAudioAnalysisPlanInput {
  sessionId: string;
  sessionStatus: "saved" | "discarded" | "interrupted" | string;
  recordingAvailable: boolean;
  explicitAudioAnalysisConsent: boolean;
  retentionPolicyAllowsAudio: boolean;
}

export function buildPostSessionAudioAnalysisPlan(input: BuildPostSessionAudioAnalysisPlanInput): PostSessionAudioAnalysisPlan {
  const reasons: string[] = [];
  if (input.sessionStatus !== "saved") reasons.push("post-session audio analysis is allowed only for saved sessions");
  if (!input.recordingAvailable) reasons.push("no saved raw audio recording is available");
  if (!input.explicitAudioAnalysisConsent) reasons.push("explicit audio analysis consent is required");
  if (!input.retentionPolicyAllowsAudio) reasons.push("retention policy does not allow raw audio processing");
  const allowed = reasons.length === 0;
  return {
    status: allowed ? "planned" : "blocked",
    sessionId: input.sessionId,
    allowed,
    reasons,
    proposedProvider: allowed ? "vibevoice_asr_lab" : "none",
    expectedOutputs: allowed
      ? ["speaker_timestamps", "long_transcript", "commitments", "tasks", "meeting_recap", "risk_flags", "research_requests"]
      : [],
  };
}
