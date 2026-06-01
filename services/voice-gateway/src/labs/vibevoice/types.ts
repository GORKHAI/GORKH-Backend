export type VibeVoiceLabKind = "asr" | "realtime_tts";

export interface VibeVoiceLabConfig {
  voiceLabsEnabled: boolean;
  vibeVoiceLabEnabled: boolean;
  asrLabEnabled: boolean;
  realtimeTtsLabEnabled: boolean;
  modelPath?: string;
  serverUrl?: string;
  allowSyntheticVoice: boolean;
  nodeEnv: string;
}

export interface VibeVoiceLabErrorBody {
  code: "provider_not_configured" | "synthetic_voice_policy_denied";
  message: string;
  retryable: boolean;
  details: Record<string, unknown>;
}

export class VibeVoiceLabProviderError extends Error {
  readonly body: VibeVoiceLabErrorBody;

  constructor(body: VibeVoiceLabErrorBody) {
    super(body.message);
    this.name = "VibeVoiceLabProviderError";
    this.body = body;
  }
}

export interface VibeVoiceLongFormAsrInput {
  audioRef: string;
  hotwords?: string[];
  languageHint?: string;
  consentChecked: boolean;
}

export interface VibeVoiceRealtimeTtsInput {
  textStreamId: string;
  voicePreset?: string;
  disclosureRequired: boolean;
}

export interface VibeVoiceLabTranscriptSegment {
  speaker: string;
  text: string;
  startMs?: number;
  endMs?: number;
  confidence?: number;
}

export interface VibeVoiceLabAudioChunk {
  sequence: number;
  mimeType: "audio/wav" | "audio/pcm";
  bytes: Uint8Array;
}
