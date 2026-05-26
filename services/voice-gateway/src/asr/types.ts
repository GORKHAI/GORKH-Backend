export class AsrProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AsrProviderError";
  }
}

export interface AsrSegment {
  speaker: string;
  text: string;
  offsetMs?: number;
  confidence?: number | null;
  isFinal: boolean;
}

export interface AsrProvider {
  readonly name: "none" | "deepgram";
  start(params: {
    onPartial: (segment: AsrSegment) => void;
    onFinal: (segment: AsrSegment) => void;
    onError: (error: Error) => void;
  }): Promise<void>;
  sendPcm(frame: Buffer): void | Promise<void>;
  stop(): Promise<void>;
}
