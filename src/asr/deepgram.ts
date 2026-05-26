import { createClient, LiveTranscriptionEvents, type LiveClient } from "@deepgram/sdk";
import { config, requireKey } from "../config.js";
import type { BufferedSegment } from "../redis.js";

export interface DeepgramStreamHandlers {
  onFinal: (seg: BufferedSegment) => void;
  onPartial?: (seg: BufferedSegment) => void;
  onError?: (err: Error) => void;
  onClose?: () => void;
}

export interface DeepgramStreamOptions {
  selfSpeakerIndex?: number | null;
  sampleRate?: number;
}

export interface DeepgramStream {
  sendAudio: (chunk: Buffer | ArrayBuffer | Uint8Array) => void;
  close: () => void;
}

interface DGWord {
  word?: string;
  punctuated_word?: string;
  speaker?: number;
  start?: number;
  confidence?: number;
}

interface DGAlternative {
  transcript?: string;
  confidence?: number;
  words?: DGWord[];
}

interface DGTranscriptEvent {
  is_final?: boolean;
  channel?: { alternatives?: DGAlternative[] };
  start?: number;
}

export function openDeepgramStream(
  handlers: DeepgramStreamHandlers,
  opts: DeepgramStreamOptions = {},
): DeepgramStream {
  const dg = createClient(requireKey(config.DEEPGRAM_API_KEY, "Deepgram (DEEPGRAM_API_KEY)"));
  const selfIdx = opts.selfSpeakerIndex ?? null;
  const connection: LiveClient = dg.listen.live({
    model: config.DEEPGRAM_MODEL,
    language: "en",
    smart_format: true,
    punctuate: true,
    diarize: true,
    interim_results: true,
    encoding: "linear16",
    sample_rate: opts.sampleRate ?? 16000,
    channels: 1,
  });

  connection.on(LiveTranscriptionEvents.Transcript, (data: DGTranscriptEvent) => {
    const alt = data.channel?.alternatives?.[0];
    const transcript = alt?.transcript?.trim();
    if (!alt || !transcript) return;
    if (data.is_final && alt.words && alt.words.length > 0) {
      for (const run of splitSpeakerRuns(alt.words, selfIdx, Math.round((data.start ?? 0) * 1000), alt.confidence ?? null)) {
        handlers.onFinal(run);
      }
      return;
    }
    const segment: BufferedSegment = {
      speaker: labelSpeaker(dominantSpeaker(alt.words), selfIdx),
      text: transcript,
      offsetMs: Math.round((data.start ?? 0) * 1000),
      confidence: alt.confidence ?? null,
    };
    if (data.is_final) handlers.onFinal(segment);
    else handlers.onPartial?.(segment);
  });

  connection.on(LiveTranscriptionEvents.Error, (err: unknown) => {
    handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
  });
  connection.on(LiveTranscriptionEvents.Close, () => handlers.onClose?.());

  return {
    sendAudio: (chunk) => connection.send(toArrayBuffer(chunk)),
    close: () => {
      const closable = connection as unknown as { requestClose?: () => void; finish?: () => void };
      if (closable.requestClose) closable.requestClose();
      else closable.finish?.();
    },
  };
}

function splitSpeakerRuns(words: DGWord[], selfIdx: number | null, fallbackOffsetMs: number, fallbackConfidence: number | null): BufferedSegment[] {
  const runs: BufferedSegment[] = [];
  let currentSpeaker: number | null = null;
  let currentWords: string[] = [];
  let currentStart = fallbackOffsetMs;
  let confidenceSum = 0;
  let confidenceCount = 0;

  function flush(): void {
    if (currentSpeaker === null || currentWords.length === 0) return;
    runs.push({
      speaker: labelSpeaker(currentSpeaker, selfIdx),
      text: currentWords.join(" ").trim(),
      offsetMs: currentStart,
      confidence: confidenceCount > 0 ? confidenceSum / confidenceCount : fallbackConfidence,
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

function dominantSpeaker(words: DGWord[] | undefined): number {
  if (!words || words.length === 0) return 0;
  const counts = new Map<number, number>();
  for (const word of words) {
    const speaker = typeof word.speaker === "number" ? word.speaker : 0;
    counts.set(speaker, (counts.get(speaker) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

function labelSpeaker(speaker: number, selfIdx: number | null): string {
  return selfIdx !== null && speaker === selfIdx ? "me" : `speaker_${speaker}`;
}

function toArrayBuffer(chunk: Buffer | ArrayBuffer | Uint8Array): ArrayBuffer {
  if (chunk instanceof ArrayBuffer) return chunk;
  const view = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}
