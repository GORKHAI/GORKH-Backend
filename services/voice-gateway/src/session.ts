import { randomUUID } from "node:crypto";
import type { RawData, WebSocket } from "ws";
import { BackendVoiceClient } from "./backend-client.js";
import { asrUnavailableMessage, gatewayConfig, isAsrAvailable } from "./config.js";
import { createCounters, nowIso, type GatewayCounters } from "./metrics.js";
import { DeepgramAsrProvider } from "./asr/deepgram.js";
import { NoneAsrProvider } from "./asr/none.js";
import type { AsrProvider, AsrSegment } from "./asr/types.js";
import { gatewayClientEventSchema, type BackendVoiceEvent, type GatewayInputKind, type GatewayOutputKind, type GatewayPolicy, type GatewayServerEvent, type GatewayStartEvent, type GatewayState } from "./types.js";

export interface BackendClientLike {
  start(start: GatewayStartEvent): Promise<{ sessionId: string; voiceSessionId: string }>;
  sendUserText(text: string): void;
  sendTranscript(segment: { speaker: string; text: string; offsetMs?: number }): void;
  sendSpeechStarted(): void;
  sendSpeechEnded(): void;
  sendStop(save: boolean): void;
  close(): void;
  on(event: "event", listener: (event: BackendVoiceEvent) => void): this;
  on(event: "close", listener: () => void): this;
  on(event: "error", listener: (error: Error) => void): this;
}

interface GatewaySessionDeps {
  createBackendClient?: (token: string) => BackendClientLike;
  createAsrProvider?: () => AsrProvider;
  emit?: (event: GatewayServerEvent) => void;
}

export interface GatewaySessionDebug {
  gatewaySessionId: string;
  backendSessionId: string | null;
  policy: GatewayPolicy | null;
  inputKind: GatewayInputKind | null;
  outputKind: GatewayOutputKind | null;
  state: GatewayState;
  asrProvider: "none" | "deepgram";
  createdAt: string;
  lastClientEventAt: string | null;
  lastBackendEventAt: string | null;
  counts: GatewayCounters;
}

export class GatewaySession {
  readonly gatewaySessionId = randomUUID();
  readonly createdAt = nowIso();
  readonly counts = createCounters();
  private backend: BackendClientLike | null = null;
  private asr: AsrProvider | null = null;
  private lastGatewayStartMs: number | null = null;
  private lastBackendForwardedMs: number | null = null;
  private lastBackendEventMs: number | null = null;
  private active = true;
  private generation = 0;
  private idleTimer: NodeJS.Timeout | null = null;
  private explicitlyStopped = false;

  backendSessionId: string | null = null;
  backendVoiceSessionId: string | null = null;
  policy: GatewayPolicy | null = null;
  inputKind: GatewayInputKind | null = null;
  outputKind: GatewayOutputKind | null = null;
  state: GatewayState = "idle";
  lastClientEventAt: string | null = null;
  lastBackendEventAt: string | null = null;

  constructor(
    readonly userId: string,
    private readonly token: string,
    private readonly emit: (event: GatewayServerEvent) => void,
    private readonly deps: GatewaySessionDeps = {},
  ) {}

  async handleText(data: string): Promise<void> {
    this.bumpClient();
    const parsed = gatewayClientEventSchema.safeParse(JSON.parse(data));
    if (!parsed.success) {
      this.emit({ type: "gateway_error", stage: "protocol", message: parsed.error.message });
      return;
    }
    const msg = parsed.data;
    if (msg.type === "start") {
      await this.start(msg);
      return;
    }
    if (!this.backend || !this.active || this.state === "idle" || this.state === "failed") {
      this.emit({ type: "gateway_error", stage: "state", message: "no active gateway voice session; send start first" });
      return;
    }
    if (msg.type === "user_text") {
      this.markBackendForward();
      this.backend.sendUserText(msg.text);
    } else if (msg.type === "transcript") {
      this.markBackendForward();
      this.backend.sendTranscript({ speaker: msg.speaker, text: msg.text, offsetMs: msg.offsetMs });
    } else if (msg.type === "speech_started") {
      this.markBackendForward();
      this.backend.sendSpeechStarted();
    } else if (msg.type === "speech_ended") {
      this.markBackendForward();
      this.backend.sendSpeechEnded();
    }
    else if (msg.type === "stop") await this.stop(msg.save);
  }

  async handleBinary(data: RawData): Promise<void> {
    this.bumpClient();
    if (!this.active || this.state === "idle" || !this.asr || this.inputKind !== "pcm16") {
      this.emit({ type: "gateway_error", stage: "protocol", message: "binary audio is not accepted before a consented pcm16 session starts" });
      return;
    }
    const frame = rawDataToBuffer(data);
    if (frame.byteLength > gatewayConfig.GATEWAY_MAX_PCM_FRAME_BYTES) {
      this.emit({ type: "gateway_error", stage: "protocol", message: `pcm frame exceeds ${gatewayConfig.GATEWAY_MAX_PCM_FRAME_BYTES} bytes` });
      return;
    }
    this.counts.pcmFrames++;
    await this.asr.sendPcm(frame);
  }

  async disconnect(): Promise<void> {
    if (!this.active || this.explicitlyStopped) return;
    this.active = false;
    this.generation++;
    this.state = "interrupted";
    this.clearIdleTimer();
    await this.asr?.stop().catch(() => undefined);
    this.backend?.close();
  }

  getDebug(): GatewaySessionDebug {
    return {
      gatewaySessionId: this.gatewaySessionId,
      backendSessionId: this.backendSessionId,
      policy: this.policy,
      inputKind: this.inputKind,
      outputKind: this.outputKind,
      state: this.state,
      asrProvider: gatewayConfig.VOICE_GATEWAY_ASR_PROVIDER,
      createdAt: this.createdAt,
      lastClientEventAt: this.lastClientEventAt,
      lastBackendEventAt: this.lastBackendEventAt,
      counts: { ...this.counts },
    };
  }

  private async start(start: GatewayStartEvent): Promise<void> {
    if (this.backend || this.state !== "idle") {
      this.emit({ type: "gateway_error", stage: "start", message: "gateway voice session already started" });
      return;
    }
    if (start.consent.granted !== true) {
      this.state = "failed";
      this.emit({ type: "gateway_error", stage: "consent", message: "Live assist cannot start without explicit consent." });
      return;
    }
    if (start.input.kind === "pcm16" && !this.deps.createAsrProvider && !isAsrAvailable()) {
      this.state = "failed";
      this.emit({ type: "gateway_provider_error", stage: "asr", message: asrUnavailableMessage() });
      return;
    }

    this.state = "starting";
    this.lastGatewayStartMs = Date.now();
    this.policy = start.policy;
    this.inputKind = start.input.kind;
    this.outputKind = start.output.kind;
    this.emit({ type: "gateway_state", state: "starting" });
    this.backend = (this.deps.createBackendClient ?? ((token) => new BackendVoiceClient(token)))(this.token);
    this.backend.on("event", (event: BackendVoiceEvent) => void this.handleBackendEvent(event));
    this.backend.on("close", () => {
      if (this.active && !this.explicitlyStopped) void this.disconnect();
    });
    this.backend.on("error", (err: Error) => this.emit({ type: "gateway_error", stage: "backend", message: err.message }));

    const generation = this.generation;
    const ack = await this.backend.start(start);
    if (!this.canEmit(generation)) return;
    this.backendSessionId = ack.sessionId;
    this.backendVoiceSessionId = ack.voiceSessionId;
    this.state = "connected_to_backend";
    rememberGatewaySession(this);
    this.emit({ type: "gateway_state", state: "connected_to_backend" });
    this.emit({
      type: "gateway_ack",
      gatewaySessionId: this.gatewaySessionId,
      backendSessionId: ack.sessionId,
      backendVoiceSessionId: ack.voiceSessionId,
      policy: start.policy,
      inputKind: start.input.kind,
      outputKind: start.output.kind,
      asrProvider: gatewayConfig.VOICE_GATEWAY_ASR_PROVIDER,
      outputStrategy: gatewayConfig.VOICE_GATEWAY_OUTPUT_STRATEGY,
    });
    this.state = "listening";
    this.emit({ type: "gateway_state", state: "listening" });
    if (start.input.kind === "pcm16") await this.startAsr(generation);
    this.resetIdleTimer();
  }

  private async startAsr(generation: number): Promise<void> {
    this.asr = this.deps.createAsrProvider?.() ?? (gatewayConfig.VOICE_GATEWAY_ASR_PROVIDER === "deepgram" ? new DeepgramAsrProvider() : new NoneAsrProvider());
    await this.asr.start({
      onPartial: (segment) => {
        if (!this.canEmit(generation)) return;
        this.emit({ type: "gateway_asr_partial", speaker: segment.speaker, text: segment.text });
      },
      onFinal: (segment) => {
        if (!this.canEmit(generation)) return;
        this.counts.asrFinals++;
        this.emit({ type: "gateway_asr_final", speaker: segment.speaker, text: segment.text, offsetMs: segment.offsetMs });
        if (this.lastGatewayStartMs !== null) {
          this.emit({ type: "gateway_metrics", latencyMs: { gatewayToAsrFinal: Math.max(0, Date.now() - this.lastGatewayStartMs) } });
        }
        this.markBackendForward();
        if (this.policy === "conversation_agent") this.backend?.sendUserText(segment.text);
        else this.backend?.sendTranscript({ speaker: segment.speaker, text: segment.text, offsetMs: segment.offsetMs ?? 0 });
      },
      onError: (error) => this.emit({ type: "gateway_provider_error", stage: "asr", message: error.message }),
    });
  }

  private async handleBackendEvent(event: BackendVoiceEvent): Promise<void> {
    if (!this.active || ["stopped", "interrupted", "failed"].includes(this.state)) return;
    this.counts.backendMessages++;
    this.lastBackendEventAt = nowIso();
    this.lastBackendEventMs = Date.now();
    this.emit(event);
    if (this.lastBackendForwardedMs !== null) {
      this.emit({
        type: "gateway_metrics",
        latencyMs: {
          gatewayToBackend: Math.max(0, this.lastBackendEventMs - this.lastBackendForwardedMs),
          backendToGateway: 0,
        },
      });
    }
    if (event.type === "voice_speak_request" && gatewayConfig.VOICE_GATEWAY_OUTPUT_STRATEGY === "client_tts") {
      const now = Date.now();
      this.emit({
        type: "gateway_client_tts_instruction",
        speechId: String(event.speechId),
        text: String(event.text ?? "").trim(),
        delivery: String(event.delivery ?? "screen"),
        sourceEvent: "voice_speak_request",
        maxWords: 8,
      });
      this.emit({
        type: "gateway_metrics",
        latencyMs: {
          gatewayToClientTtsInstruction: Math.max(0, Date.now() - now),
        },
      });
    }
  }

  private async stop(save: boolean): Promise<void> {
    if (!this.backend || !this.active) return;
    this.explicitlyStopped = true;
    this.state = "stopping";
    this.emit({ type: "gateway_state", state: "stopping" });
    this.backend.sendStop(save);
    await delay(1000);
    this.active = false;
    this.generation++;
    this.clearIdleTimer();
    await this.asr?.stop().catch(() => undefined);
    this.backend.close();
    this.state = "stopped";
    this.emit({ type: "gateway_state", state: "stopped" });
  }

  private bumpClient(): void {
    this.counts.clientMessages++;
    this.lastClientEventAt = nowIso();
    this.resetIdleTimer();
  }

  private markBackendForward(): void {
    this.lastBackendForwardedMs = Date.now();
  }

  private resetIdleTimer(): void {
    this.clearIdleTimer();
    if (!this.active) return;
    this.idleTimer = setTimeout(() => void this.disconnect(), gatewayConfig.GATEWAY_SESSION_IDLE_TIMEOUT_MS);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private canEmit(generation: number): boolean {
    return this.active && this.generation === generation && !["stopped", "interrupted", "failed"].includes(this.state);
  }
}

const sessionsByGatewayId = new Map<string, GatewaySession>();

export function rememberGatewaySession(session: GatewaySession): void {
  sessionsByGatewayId.set(session.gatewaySessionId, session);
}

export function getGatewaySessionForUser(userId: string, gatewaySessionId: string): GatewaySessionDebug | null {
  const session = sessionsByGatewayId.get(gatewaySessionId);
  if (!session || session.userId !== userId) return null;
  return session.getDebug();
}

export function clearGatewaySessionsForTest(): void {
  sessionsByGatewayId.clear();
}

function rawDataToBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
