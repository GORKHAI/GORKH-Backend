import type { VibeVoiceLabConfig, VibeVoiceLabTranscriptSegment, VibeVoiceLongFormAsrInput } from "./types.js";
import { assertVibeVoiceLabSelectable, resolveVibeVoiceLabConfig } from "./safety.js";

export interface VibeVoiceAsrLabProvider {
  readonly name: "vibevoice_asr_lab";
  transcribeLongForm(input: VibeVoiceLongFormAsrInput): Promise<VibeVoiceLabTranscriptSegment[]>;
}

export class DisabledVibeVoiceAsrLabProvider implements VibeVoiceAsrLabProvider {
  readonly name = "vibevoice_asr_lab" as const;

  constructor(private readonly config: VibeVoiceLabConfig = resolveVibeVoiceLabConfig()) {}

  async transcribeLongForm(_input: VibeVoiceLongFormAsrInput): Promise<VibeVoiceLabTranscriptSegment[]> {
    assertVibeVoiceLabSelectable("asr", this.config);
    throw new Error("VibeVoice ASR lab runtime is not implemented in this repository.");
  }
}
