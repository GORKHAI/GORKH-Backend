import type { TtsProvider } from "./provider.js";
import type { TtsSynthesisParams, TtsSynthesisResult } from "./types.js";
import { TtsProviderError } from "./types.js";

export class NoneTtsProvider implements TtsProvider {
  readonly name = "none" as const;

  async synthesize(_params: TtsSynthesisParams): Promise<TtsSynthesisResult> {
    throw new TtsProviderError("tts_provider_not_configured", "Natural Voice provider is not configured.", false, 503);
  }
}
