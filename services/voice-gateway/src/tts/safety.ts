import { createHash } from "node:crypto";
import { gatewayConfig } from "../config.js";
import { getVoiceCharacter } from "./characters.js";
import type { TtsPurpose, TtsSynthesisParams, VoiceCharacterId } from "./types.js";
import { TtsProviderError } from "./types.js";

const unsafeVoiceIntentPattern =
  /\b(clone|impersonate|imitate|sound like|copy (?:a )?voice|celebrity voice|sound like (?:elon|trump|biden|my boss|my friend|my partner|an investor))\b/i;

export interface SafeTtsInput {
  text: string;
  characterId: VoiceCharacterId;
  purpose: TtsPurpose;
  speechId?: string;
  outputFormat: "audio/mpeg" | "audio/wav";
  textHash: string;
}

export function validateTtsInput(params: TtsSynthesisParams & { deliveryTarget?: string }): SafeTtsInput {
  if (params.deliveryTarget === "screen_only") {
    throw new TtsProviderError("tts_screen_only_rejected", "Screen-only reports are not spoken.", false, 400);
  }

  const text = params.text.trim();
  if (!text) {
    throw new TtsProviderError("tts_empty_text", "Text is required for Natural Voice.", false, 400);
  }
  if (text.length > gatewayConfig.TTS_MAX_TEXT_CHARS) {
    throw new TtsProviderError("tts_text_too_long", `Natural Voice text must be ${gatewayConfig.TTS_MAX_TEXT_CHARS} characters or less.`, false, 400);
  }
  if (params.purpose === "whisper_cue" && text.length > gatewayConfig.TTS_WHISPER_MAX_TEXT_CHARS) {
    throw new TtsProviderError("tts_whisper_text_too_long", `Whisper cues must be ${gatewayConfig.TTS_WHISPER_MAX_TEXT_CHARS} characters or less.`, false, 400);
  }
  if (unsafeVoiceIntentPattern.test(text)) {
    throw new TtsProviderError(
      "tts_impersonation_rejected",
      "NearMind does not clone or imitate real people’s voices. Choose one of the built-in assistant voices.",
      false,
      400,
    );
  }

  const character = getVoiceCharacter(params.voiceCharacterId);
  if (!character) {
    throw new TtsProviderError("tts_voice_unknown", "Unknown Natural Voice character.", false, 400);
  }
  if (params.purpose === "whisper_cue" && !character.allowedForWhisper) {
    throw new TtsProviderError("tts_voice_not_allowed_for_whisper", "This voice is not allowed for Whisper Copilot cues.", false, 400);
  }
  if (params.purpose === "stress_support" && !character.allowedForStressSupport) {
    throw new TtsProviderError("tts_voice_not_allowed_for_stress_support", "This voice is not allowed for stress-support responses.", false, 400);
  }
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (character.maxSpokenWords && wordCount > character.maxSpokenWords) {
    throw new TtsProviderError("tts_word_limit_exceeded", `This voice can speak up to ${character.maxSpokenWords} words.`, false, 400);
  }

  return {
    text,
    characterId: character.id,
    purpose: params.purpose,
    speechId: params.speechId,
    outputFormat: params.outputFormat,
    textHash: hashTtsText(text),
  };
}

export function hashTtsText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}
