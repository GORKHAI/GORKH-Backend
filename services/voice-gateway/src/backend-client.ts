import { EventEmitter } from "node:events";
import WebSocket from "ws";
import { gatewayConfig } from "./config.js";
import type { BackendVoiceAck, BackendVoiceEvent, GatewayStartEvent } from "./types.js";

export interface BackendClientEvents {
  event: [BackendVoiceEvent];
  close: [];
  error: [Error];
}

export class BackendVoiceClient extends EventEmitter<BackendClientEvents> {
  private socket: WebSocket | null = null;
  private started = false;

  constructor(private readonly token: string) {
    super();
  }

  async start(start: GatewayStartEvent): Promise<BackendVoiceAck> {
    if (this.started) throw new Error("backend voice session already started");
    this.started = true;
    const ws = new WebSocket(`${gatewayConfig.GORKH_BACKEND_WS_URL.replace(/\/$/, "")}/voice?token=${encodeURIComponent(this.token)}`);
    this.socket = ws;

    await withTimeout(
      new Promise<void>((resolve, reject) => {
        ws.once("open", resolve);
        ws.once("error", reject);
      }),
      gatewayConfig.GATEWAY_BACKEND_CONNECT_TIMEOUT_MS,
      "backend /voice connection timed out",
    );

    const ackPromise = waitForAck(ws);
    ws.on("message", (data) => {
      const event = JSON.parse(data.toString()) as BackendVoiceEvent;
      this.emit("event", event);
    });
    ws.on("close", () => this.emit("close"));
    ws.on("error", (err) => this.emit("error", err instanceof Error ? err : new Error(String(err))));

    ws.send(
      JSON.stringify({
        type: "start",
        protocolVersion: start.protocolVersion ?? 1,
        policy: start.policy,
        situationBriefId: start.situationBriefId,
        situationDescription: start.situationDescription,
        title: start.title,
        consent: start.consent,
        input: { kind: "text" },
        output: { kind: start.output.kind },
        retentionPolicy: start.retentionPolicy,
      }),
    );
    return withTimeout(ackPromise, gatewayConfig.GATEWAY_BACKEND_CONNECT_TIMEOUT_MS, "backend /voice start timed out");
  }

  sendUserText(text: string): void {
    this.send({ type: "user_text", text });
  }

  sendTranscript(segment: { speaker: string; text: string; offsetMs?: number }): void {
    this.send({ type: "transcript", speaker: segment.speaker, text: segment.text, offsetMs: segment.offsetMs ?? 0 });
  }

  sendSpeechStarted(event?: { speechId?: string; timestamp?: string }): void {
    this.send({ type: "speech_started", speechId: event?.speechId, timestamp: event?.timestamp });
  }

  sendSpeechEnded(): void {
    this.send({ type: "speech_ended" });
  }

  sendStop(save: boolean): void {
    this.send({ type: "stop", save });
  }

  close(): void {
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) this.socket.close();
    this.socket = null;
  }

  private send(payload: unknown): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) throw new Error("backend /voice socket is not open");
    this.socket.send(JSON.stringify(payload));
  }
}

function waitForAck(ws: WebSocket): Promise<BackendVoiceAck> {
  return new Promise((resolve, reject) => {
    function onMessage(data: WebSocket.RawData): void {
      const event = JSON.parse(data.toString()) as BackendVoiceEvent;
      if (event.type === "voice_ack") {
        cleanup();
        resolve(event as unknown as BackendVoiceAck);
      } else if (event.type === "error") {
        cleanup();
        reject(new Error(String(event.message ?? "backend /voice start failed")));
      }
    }
    function onError(err: Error): void {
      cleanup();
      reject(err);
    }
    function cleanup(): void {
      ws.off("message", onMessage);
      ws.off("error", onError);
    }
    ws.on("message", onMessage);
    ws.on("error", onError);
  });
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
