import type { WebSocket } from "ws";
import { z } from "zod";
import {
  startSession,
  stopSession,
  ingestFinalSegment,
  attach,
  isLive,
  type OutboundEvent,
} from "../session/manager.js";
import { openDeepgramStream, type DeepgramStream } from "../asr/deepgram.js";
import type { SessionMode } from "../db/schema.js";

const startMsg = z.object({
  type: z.literal("start"),
  userId: z.string().uuid(),
  mode: z.enum(["personal", "meeting", "bank", "negotiation"]),
  consent: z.boolean(),
  title: z.string().optional(),
  /** Set when streaming live audio so Deepgram can label the user's voice. */
  selfSpeakerIndex: z.number().int().nullable().optional(),
  /** "audio" opens a Deepgram stream; "text" expects transcript messages. */
  source: z.enum(["audio", "text"]).default("text"),
});

const transcriptMsg = z.object({
  type: z.literal("transcript"),
  text: z.string().min(1),
  speaker: z.string().default("speaker_0"),
  offsetMs: z.number().int().nonnegative().default(0),
});

const stopMsg = z.object({
  type: z.literal("stop"),
  save: z.boolean().default(true),
});

const inbound = z.discriminatedUnion("type", [startMsg, transcriptMsg, stopMsg]);

export function handleConnection(socket: WebSocket): void {
  let sessionId: string | null = null;
  let dgStream: DeepgramStream | null = null;

  const emit: OutboundEvent extends never ? never : (e: OutboundEvent) => void = (e) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(e));
  };

  // Serialise message handling per connection so a fast-following message
  // (e.g. a transcript sent immediately after start) cannot race ahead of the
  // still-awaiting start handler.
  let queue: Promise<void> = Promise.resolve();
  socket.on("message", (data: Buffer, isBinary: boolean) => {
    queue = queue
      .then(() => handleMessage(data, isBinary))
      .catch((err) =>
        emit({ type: "error", stage: "handler", message: String((err as Error).message) }),
      );
  });

  async function handleMessage(data: Buffer, isBinary: boolean): Promise<void> {
    try {
      // Binary frames are raw PCM audio for the active Deepgram stream.
      if (isBinary) {
        if (dgStream) dgStream.sendAudio(data);
        return;
      }

      const parsed = inbound.safeParse(JSON.parse(data.toString("utf8")));
      if (!parsed.success) {
        emit({ type: "error", stage: "protocol", message: parsed.error.message });
        return;
      }
      const msg = parsed.data;

      if (msg.type === "start") {
        if (sessionId) {
          emit({ type: "error", stage: "start", message: "session already started" });
          return;
        }
        sessionId = await startSession({
          userId: msg.userId,
          mode: msg.mode as SessionMode,
          consentGranted: msg.consent,
          title: msg.title,
          emit,
        });
        if (msg.source === "audio") {
          dgStream = openDeepgramStream(
            {
              onFinal: (seg) => {
                if (sessionId) void ingestFinalSegment(sessionId, seg).catch((err) =>
                  emit({ type: "error", stage: "ingest", message: String(err.message) }),
                );
              },
              onPartial: (seg) =>
                emit({ type: "segment", speaker: seg.speaker, text: seg.text, isFinal: false }),
              onError: (err) => emit({ type: "error", stage: "asr", message: err.message }),
            },
            { selfSpeakerIndex: msg.selfSpeakerIndex ?? null },
          );
        }
        return;
      }

      if (!sessionId || !isLive(sessionId)) {
        emit({ type: "error", stage: "state", message: "no active session; send start first" });
        return;
      }
      attach(sessionId, emit);

      if (msg.type === "transcript") {
        await ingestFinalSegment(sessionId, {
          speaker: msg.speaker,
          text: msg.text,
          offsetMs: msg.offsetMs,
        });
        return;
      }

      if (msg.type === "stop") {
        dgStream?.close();
        dgStream = null;
        await stopSession(sessionId, msg.save);
        sessionId = null;
        return;
      }
    } catch (err) {
      emit({ type: "error", stage: "handler", message: String((err as Error).message) });
    }
  }

  socket.on("close", async () => {
    dgStream?.close();
    // Connection dropped without an explicit stop: persist what we have.
    if (sessionId && isLive(sessionId)) {
      await stopSession(sessionId, true).catch(() => undefined);
    }
  });
}
