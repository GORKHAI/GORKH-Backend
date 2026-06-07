import { gatewayConfig } from "../config.js";
import { getVoiceCharacter } from "./characters.js";
import type { TtsProvider } from "./provider.js";
import { hashTtsText, validateTtsInput } from "./safety.js";
import type { TtsSynthesisParams, TtsSynthesisResult } from "./types.js";
import { TtsProviderError } from "./types.js";

export class DeepgramAuraTtsProvider implements TtsProvider {
  readonly name = "deepgram_aura" as const;

  async synthesize(params: TtsSynthesisParams): Promise<TtsSynthesisResult> {
    if (!gatewayConfig.DEEPGRAM_API_KEY) {
      throw new TtsProviderError("tts_provider_not_configured", "Deepgram TTS is not configured.", false, 503);
    }
    const safe = validateTtsInput(params);
    const character = getVoiceCharacter(safe.characterId);
    const model = character?.providerVoiceId;
    if (!model) {
      throw new TtsProviderError("tts_voice_not_configured", "This Natural Voice character is not configured for Deepgram Aura.", false, 503);
    }

    const startedAt = Date.now();
    const url = new URL("https://api.deepgram.com/v1/speak");
    url.searchParams.set("model", model);
    if (params.outputFormat === "audio/wav") {
      url.searchParams.set("encoding", "linear16");
      url.searchParams.set("container", "wav");
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${gatewayConfig.DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json",
        Accept: params.outputFormat,
      },
      body: JSON.stringify({ text: safe.text }),
      signal: AbortSignal.timeout(gatewayConfig.TTS_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new TtsProviderError("tts_provider_error", `Deepgram TTS returned HTTP ${response.status}.`, response.status >= 500, 502);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    if (audioBuffer.byteLength === 0) {
      throw new TtsProviderError("tts_empty_audio", "Deepgram TTS returned empty audio.", true, 502);
    }

    return {
      audioBuffer,
      contentType: response.headers.get("content-type") ?? params.outputFormat,
      provider: this.name,
      voiceCharacterId: safe.characterId,
      latencyMs: Math.max(0, Date.now() - startedAt),
      textHash: hashTtsText(safe.text),
      cached: false,
    };
  }
}
