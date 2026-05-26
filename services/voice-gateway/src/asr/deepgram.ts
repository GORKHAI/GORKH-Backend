import { createClient, LiveTranscriptionEvents, type LiveClient } from "@deepgram/sdk";
import { gatewayConfig, requireGatewayKey } from "../config.js";
import type { AsrProvider, AsrSegment } from "./types.js";

interface DeepgramWord {
  word?: string;
  punctuated_word?: string;
  speaker?: number;
  start?: number;
  confidence?: number;
}

interface DeepgramAlternative {
  transcript?: string;
  confidence?: number;
  words?: DeepgramWord[];
}

interface DeepgramTranscriptEvent {
  is_final?: boolean;
  channel?: { alternatives?: DeepgramAlternative[] };
  start?: number;
}

export class DeepgramAsrProvider implements AsrProvider {
  readonly name = "deepgram" as const;
  private connection: LiveClient | null = null;

  async start(params: {
    onPartial: (segment: AsrSegment) => void;
    onFinal: (segment: AsrSegment) => void;
    onError: (error: Error) => void;
  }): Promise<void> {
    const client = createClient(requireGatewayKey(gatewayConfig.DEEPGRAM_API_KEY, "Deepgram (DEEPGRAM_API_KEY)"));
    this.connection = client.listen.live({
      model: gatewayConfig.DEEPGRAM_MODEL,
      language: "en",
      smart_format: true,
      punctuate: true,
      diarize: true,
      interim_results: true,
      encoding: "linear16",
      sample_rate: 16000,
      channels: 1,
    });

    this.connection.on(LiveTranscriptionEvents.Transcript, (data: DeepgramTranscriptEvent) => {
      const alt = data.channel?.alternatives?.[0];
      const transcript = alt?.transcript?.trim();
      if (!alt || !transcript) return;
      if (data.is_final && alt.words && alt.words.length > 0) {
        for (const run of splitSpeakerRuns(alt.words, Math.round((data.start ?? 0) * 1000), alt.confidence ?? null)) params.onFinal(run);
        return;
      }
      const segment: AsrSegment = {
        speaker: alt.words && alt.words.length > 0 ? labelSpeaker(dominantSpeaker(alt.words)) : "speaker_unknown",
        text: transcript,
        offsetMs: Math.round((data.start ?? 0) * 1000),
        confidence: alt.confidence ?? null,
        isFinal: Boolean(data.is_final),
      };
      if (data.is_final) params.onFinal(segment);
      else params.onPartial(segment);
    });

    this.connection.on(LiveTranscriptionEvents.Error, (err: unknown) => params.onError(err instanceof Error ? err : new Error(String(err))));
  }

  sendPcm(frame: Buffer): void {
    if (!this.connection) throw new Error("Deepgram ASR stream is not started");
    this.connection.send(toArrayBuffer(frame));
  }

  async stop(): Promise<void> {
    const closable = this.connection as unknown as { requestClose?: () => void; finish?: () => void } | null;
    if (closable?.requestClose) closable.requestClose();
    else closable?.finish?.();
    this.connection = null;
  }
}

function splitSpeakerRuns(words: DeepgramWord[], fallbackOffsetMs: number, fallbackConfidence: number | null): AsrSegment[] {
  const runs: AsrSegment[] = [];
  let currentSpeaker: number | null = null;
  let currentWords: string[] = [];
  let currentStart = fallbackOffsetMs;
  let confidenceSum = 0;
  let confidenceCount = 0;

  function flush(): void {
    if (currentSpeaker === null || currentWords.length === 0) return;
    runs.push({
      speaker: labelSpeaker(currentSpeaker),
      text: currentWords.join(" ").trim(),
      offsetMs: currentStart,
      confidence: confidenceCount > 0 ? confidenceSum / confidenceCount : fallbackConfidence,
      isFinal: true,
    });
    currentWords = [];
    confidenceSum = 0;
    confidenceCount = 0;
  }

  for (const word of words) {
    const speaker = typeof word.speaker === "number" ? word.speaker : 0;
    if (currentSpeaker !== null && speaker !== currentSpeaker) flush();
    if (currentSpeaker !== speaker) {
      currentSpeaker = speaker;
      currentStart = Math.round((word.start ?? fallbackOffsetMs / 1000) * 1000);
    }
    currentWords.push(word.punctuated_word ?? word.word ?? "");
    if (typeof word.confidence === "number") {
      confidenceSum += word.confidence;
      confidenceCount++;
    }
  }
  flush();
  return runs.filter((run) => run.text.length > 0);
}

function dominantSpeaker(words: DeepgramWord[] | undefined): number {
  if (!words || words.length === 0) return 0;
  const counts = new Map<number, number>();
  for (const word of words) {
    const speaker = typeof word.speaker === "number" ? word.speaker : 0;
    counts.set(speaker, (counts.get(speaker) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

function labelSpeaker(speaker: number): string {
  return `speaker_${speaker}`;
}

function toArrayBuffer(chunk: Buffer): ArrayBuffer {
  return chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer;
}
