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
  /**
   * Which diarized speaker index corresponds to the app user. That speaker's
   * segments are relabeled "me"; others become "speaker_<n>". If null, no
   * segment is treated as the user (all become speaker_<n>). Mobile clients
   * should set this after a short calibration ("tap when you're speaking").
   */
  selfSpeakerIndex?: number | null;
  sampleRate?: number;
}

export interface DeepgramStream {
  /** Forward raw PCM16 audio (e.g. 16kHz mono linear16) from the device mic. */
  sendAudio: (chunk: Buffer | ArrayBuffer | Uint8Array) => void;
  close: () => void;
}

interface DGWord {
  word: string;
  speaker?: number;
  start: number;
}
interface DGAlternative {
  transcript: string;
  words?: DGWord[];
}
interface DGTranscriptEvent {
  is_final?: boolean;
  channel?: { alternatives?: DGAlternative[] };
  start?: number;
}

/**
 * Open a Deepgram live transcription stream. Throws if DEEPGRAM_API_KEY is unset.
 * Diarization + interim results enabled. Final segments are split per speaker so
 * the trigger classifier can reason about who said what.
 */
export function openDeepgramStream(
  handlers: DeepgramStreamHandlers,
  opts: DeepgramStreamOptions = {},
): DeepgramStream {
  const key = requireKey(config.DEEPGRAM_API_KEY, "Deepgram (DEEPGRAM_API_KEY)");
  const dg = createClient(key);
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
    if (!transcript) return;

    const speaker = dominantSpeaker(alt?.words, selfIdx);
    const seg: BufferedSegment = {
      speaker,
      text: transcript,
      offsetMs: Math.round((data.start ?? 0) * 1000),
    };
    if (data.is_final) handlers.onFinal(seg);
    else handlers.onPartial?.(seg);
  });

  connection.on(LiveTranscriptionEvents.Error, (err: unknown) => {
    handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
  });
  connection.on(LiveTranscriptionEvents.Close, () => handlers.onClose?.());

  return {
    sendAudio: (chunk) => {
      connection.send(toArrayBuffer(chunk));
    },
    close: () => {
      // v3 graceful close.
      const c = connection as unknown as { requestClose?: () => void; finish?: () => void };
      if (typeof c.requestClose === "function") c.requestClose();
      else if (typeof c.finish === "function") c.finish();
    },
  };
}

/** Normalise any binary chunk to a plain ArrayBuffer for the SDK socket. */
function toArrayBuffer(chunk: Buffer | ArrayBuffer | Uint8Array): ArrayBuffer {
  if (chunk instanceof ArrayBuffer) return chunk;
  const u8 = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

/** Pick the most frequent speaker index across the words of a final result. */
function dominantSpeaker(words: DGWord[] | undefined, selfIdx: number | null): string {
  if (!words || words.length === 0) return "speaker_0";
  const counts = new Map<number, number>();
  for (const w of words) {
    const sp = typeof w.speaker === "number" ? w.speaker : 0;
    counts.set(sp, (counts.get(sp) ?? 0) + 1);
  }
  let best = 0;
  let bestN = -1;
  for (const [sp, n] of counts) {
    if (n > bestN) {
      bestN = n;
      best = sp;
    }
  }
  return selfIdx !== null && best === selfIdx ? "me" : `speaker_${best}`;
}
