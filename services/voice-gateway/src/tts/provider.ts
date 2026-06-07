import type { TtsSynthesisParams, TtsSynthesisResult } from "./types.js";

export interface TtsProvider {
  readonly name: "none" | "deepgram_aura";
  synthesize(params: TtsSynthesisParams): Promise<TtsSynthesisResult>;
}
