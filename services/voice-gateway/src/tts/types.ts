export const voiceCharacterIds = ["calm_guide", "professional", "warm_support", "focus_whisper", "briefing_voice"] as const;
export type VoiceCharacterId = (typeof voiceCharacterIds)[number];

export const ttsPurposes = ["assistant_response", "whisper_cue", "daily_brief", "stress_support", "investor_prep"] as const;
export type TtsPurpose = (typeof ttsPurposes)[number];

export interface VoiceCharacter {
  id: VoiceCharacterId;
  displayName: string;
  description: string;
  useCase: string;
  riskNotes: string;
  providerVoiceId?: string;
  maxSpokenWords?: number;
  allowedForWhisper: boolean;
  allowedForStressSupport: boolean;
}

export interface TtsSynthesisParams {
  text: string;
  voiceCharacterId: VoiceCharacterId;
  speechId?: string;
  purpose: TtsPurpose;
  outputFormat: "audio/mpeg" | "audio/wav";
  userId?: string;
  sessionId?: string;
}

export interface TtsSynthesisResult {
  audioBuffer: Buffer;
  contentType: string;
  provider: "none" | "deepgram_aura";
  voiceCharacterId: VoiceCharacterId;
  durationMs?: number;
  latencyMs: number;
  textHash: string;
  cached: boolean;
}

export interface TtsErrorBody {
  code: string;
  message: string;
  retryable: boolean;
}

export class TtsProviderError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable = false,
    readonly statusCode = 400,
  ) {
    super(message);
  }

  toBody(): TtsErrorBody {
    return { code: this.code, message: this.message, retryable: this.retryable };
  }
}
