import type { RawData, WebSocket } from "ws";
import { z } from "zod";
import { openDeepgramStream, type DeepgramStream } from "../asr/deepgram.js";
import { config } from "../config.js";
import {
  attach,
  ingestFinalSegment,
  interruptSession,
  isLive,
  startSession,
  stopSession,
  type OutboundEvent,
} from "../session/manager.js";

const consentSchema = z.object({
  granted: z.boolean(),
  method: z.string().min(1),
  noticeText: z.string().min(1),
  participantCount: z.number().int().nonnegative().nullable().optional(),
  jurisdiction: z.string().nullable().optional(),
});

const startMsg = z.object({
  type: z.literal("start"),
  situationBriefId: z.string().uuid().optional(),
  situationDescription: z.string().min(1).optional(),
  consent: consentSchema,
  title: z.string().optional(),
  source: z.enum(["text", "audio"]).default("text"),
  retentionPolicy: z.enum(["save_on_stop", "discard_on_stop", "ask_on_stop"]).default("ask_on_stop"),
  selfSpeakerIndex: z.number().int().nullable().optional(),
});

const transcriptMsg = z.object({
  type: z.literal("transcript"),
  speaker: z.string().min(1).default("speaker_0"),
  text: z.string().min(1),
  offsetMs: z.number().int().nonnegative().default(0),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

const stopMsg = z.object({
  type: z.literal("stop"),
  save: z.boolean().default(false),
});

const inbound = z.discriminatedUnion("type", [startMsg, transcriptMsg, stopMsg]);

export function handleConnection(socket: WebSocket, userId: string): void {
  let sessionId: string | null = null;
  let deepgram: DeepgramStream | null = null;
  let started = false;
  let explicitlyStopped = false;

  const emit = (event: OutboundEvent): void => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event));
  };

  let queue: Promise<void> = Promise.resolve();
  socket.on("message", (data: RawData, isBinary: boolean) => {
    queue = queue
      .then(() => handleMessage(data, isBinary))
      .catch((err) => emit({ type: "error", stage: "handler", message: String((err as Error).message ?? err) }));
  });

  async function handleMessage(data: RawData, isBinary: boolean): Promise<void> {
    if (isBinary) {
      if (!started || !deepgram) {
        emit({ type: "error", stage: "consent", message: "Audio is not accepted before an explicitly consented audio session starts." });
        return;
      }
      deepgram.sendAudio(rawDataToBuffer(data));
      return;
    }

    const parsed = inbound.safeParse(JSON.parse(rawDataToBuffer(data).toString("utf8")));
    if (!parsed.success) {
      emit({ type: "error", stage: "protocol", message: parsed.error.message });
      return;
    }
    const message = parsed.data;

    if (message.type === "start") {
      if (sessionId) {
        emit({ type: "error", stage: "start", message: "session already started" });
        return;
      }
      if (message.consent.granted !== true) {
        emit({ type: "error", stage: "consent", message: "Live assist cannot start without explicit consent." });
        return;
      }
      if (message.source === "audio" && !config.DEEPGRAM_API_KEY) {
        emit({ type: "error", stage: "asr", message: "Deepgram (DEEPGRAM_API_KEY) is not configured" });
        return;
      }
      sessionId = await startSession({
        userId,
        situationBriefId: message.situationBriefId ?? null,
        situationDescription: message.situationDescription ?? null,
        consent: message.consent,
        title: message.title ?? null,
        retentionPolicy: message.retentionPolicy,
        emit,
      });
      started = true;
      if (message.source === "audio") {
        deepgram = openDeepgramStream(
          {
            onFinal: (segment) => {
              if (sessionId) void ingestFinalSegment(sessionId, segment).catch((err) => emit({ type: "error", stage: "ingest", message: String(err.message) }));
            },
            onPartial: (segment) => emit({ type: "segment", speaker: segment.speaker, text: segment.text, isFinal: false }),
            onError: (err) => emit({ type: "error", stage: "asr", message: err.message }),
          },
          { selfSpeakerIndex: message.selfSpeakerIndex ?? null },
        );
      }
      return;
    }

    if (!sessionId || !isLive(sessionId)) {
      emit({ type: "error", stage: "state", message: "no active session; send start first" });
      return;
    }
    attach(sessionId, emit);

    if (message.type === "transcript") {
      await ingestFinalSegment(sessionId, {
        speaker: message.speaker,
        text: message.text,
        offsetMs: message.offsetMs,
        confidence: message.confidence ?? null,
      });
      return;
    }

    if (message.type === "stop") {
      explicitlyStopped = true;
      deepgram?.close();
      deepgram = null;
      await stopSession(sessionId, message.save);
      sessionId = null;
      started = false;
    }
  }

  socket.on("close", () => {
    deepgram?.close();
    if (sessionId && !explicitlyStopped) void interruptSession(sessionId).catch(() => undefined);
  });
}

function rawDataToBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}
