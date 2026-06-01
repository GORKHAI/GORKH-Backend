export type PostSessionAudioAnalysisStatus = "planned" | "blocked" | "not_applicable";

export interface PostSessionAudioAnalysisPlan {
  status: PostSessionAudioAnalysisStatus;
  sessionId: string;
  allowed: boolean;
  reasons: string[];
  proposedProvider: "vibevoice_asr_lab" | "none";
  expectedOutputs: Array<"speaker_timestamps" | "long_transcript" | "commitments" | "tasks" | "meeting_recap" | "risk_flags" | "research_requests">;
}
