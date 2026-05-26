import { AsrProviderError, type AsrProvider, type AsrSegment } from "./types.js";

export class NoneAsrProvider implements AsrProvider {
  readonly name = "none" as const;

  async start(): Promise<void> {
    throw new AsrProviderError("ASR provider is not configured for pcm16 input.");
  }

  sendPcm(): void {
    throw new AsrProviderError("ASR provider is not configured for pcm16 input.");
  }

  async stop(): Promise<void> {
    return;
  }
}

export type { AsrProvider, AsrSegment };
