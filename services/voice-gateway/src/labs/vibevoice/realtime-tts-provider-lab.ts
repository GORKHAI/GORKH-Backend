import type { VibeVoiceLabAudioChunk, VibeVoiceLabConfig, VibeVoiceRealtimeTtsInput } from "./types.js";
import { assertVibeVoiceLabSelectable, resolveVibeVoiceLabConfig, validateSyntheticVoiceSafety } from "./safety.js";

export interface VibeVoiceRealtimeTtsLabProvider {
  readonly name: "vibevoice_realtime_tts_lab";
  synthesize(input: VibeVoiceRealtimeTtsInput): AsyncIterable<VibeVoiceLabAudioChunk>;
}

export class DisabledVibeVoiceRealtimeTtsLabProvider implements VibeVoiceRealtimeTtsLabProvider {
  readonly name = "vibevoice_realtime_tts_lab" as const;

  constructor(private readonly config: VibeVoiceLabConfig = resolveVibeVoiceLabConfig()) {}

  async *synthesize(input: VibeVoiceRealtimeTtsInput): AsyncIterable<VibeVoiceLabAudioChunk> {
    validateSyntheticVoiceSafety(
      {
        mode: "realtime_tts",
        consentForSyntheticVoice: input.disclosureRequired,
        disclosureToUser: input.disclosureRequired,
      },
      this.config,
    );
    assertVibeVoiceLabSelectable("realtime_tts", this.config);
    throw new Error("VibeVoice realtime TTS lab runtime is not implemented in this repository.");
  }
}
