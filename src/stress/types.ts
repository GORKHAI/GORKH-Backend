export type StressSignalType = "none" | "self_report" | "overwhelm" | "breathing_distress" | "crisis";
export type StressSupportKind = "grounding" | "breathing" | "deescalation" | "reframe" | "pause" | "crisis_resource" | "no_action";

export interface StressDecision {
  detected: boolean;
  signal: StressSignalType;
  confidence: number;
  crisis: boolean;
  reason: string;
}

export interface StressSupportResponse {
  supportType: StressSupportKind;
  content: string;
  status: "emitted" | "suppressed" | "escalated" | "ignored";
  confidence: number;
  crisisResource?: { name: string; description: string; locale: string };
}
