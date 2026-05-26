import type { Cue } from "../cue/fast-cues.js";
import type { VoiceServerEvent } from "./types.js";

export interface TtsProvider {
  readonly name: "none";
  requestSpeech(input: { speechId: string; text: string; delivery: Cue["delivery"] }): VoiceServerEvent[];
}

export class NoTtsProvider implements TtsProvider {
  readonly name = "none" as const;

  requestSpeech(input: { speechId: string; text: string; delivery: Cue["delivery"] }): VoiceServerEvent[] {
    return [
      { type: "voice_speak_request", speechId: input.speechId, text: input.text, delivery: input.delivery },
      {
        type: "voice_tts_unavailable",
        speechId: input.speechId,
        provider: "none",
        message: "TTS provider is not configured; emitting text only.",
      },
    ];
  }
}

export function createTtsProvider(): TtsProvider {
  return new NoTtsProvider();
}
