import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { GatewaySession, type BackendClientLike } from "../src/session.js";
import type { AsrProvider, AsrSegment } from "../src/asr/types.js";
import type { GatewayStartEvent } from "../src/types.js";
import { gatewayConfig } from "../src/config.js";

describe("gateway session manager", () => {
  it("rejects consent false before backend start", async () => {
    const backend = new FakeBackend();
    const events: Array<{ type: string; [key: string]: unknown }> = [];
    const session = new GatewaySession("user-1", "token", (event) => events.push(event), { createBackendClient: () => backend });
    await session.handleText(JSON.stringify(start({ consent: { ...consent(), granted: false } })));
    expect(backend.started).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({ type: "gateway_error", stage: "consent" }));
  });

  it("rejects pcm16 with ASR none before backend start", async () => {
    const originalProvider = gatewayConfig.VOICE_GATEWAY_ASR_PROVIDER;
    gatewayConfig.VOICE_GATEWAY_ASR_PROVIDER = "none";
    const backend = new FakeBackend();
    const events: Array<{ type: string; [key: string]: unknown }> = [];
    const session = new GatewaySession("user-1", "token", (event) => events.push(event), { createBackendClient: () => backend });
    await session.handleText(JSON.stringify(start({ input: { kind: "pcm16", sampleRate: 16000, channels: 1 } })));
    expect(backend.started).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({ type: "gateway_provider_error", stage: "asr" }));
    gatewayConfig.VOICE_GATEWAY_ASR_PROVIDER = originalProvider;
  });

  it("rejects pcm16 with Deepgram selected but missing key before backend start", async () => {
    const originalProvider = gatewayConfig.VOICE_GATEWAY_ASR_PROVIDER;
    const originalKey = gatewayConfig.DEEPGRAM_API_KEY;
    gatewayConfig.VOICE_GATEWAY_ASR_PROVIDER = "deepgram";
    gatewayConfig.DEEPGRAM_API_KEY = undefined;
    const backend = new FakeBackend();
    const events: Array<{ type: string; [key: string]: unknown }> = [];
    const session = new GatewaySession("user-1", "token", (event) => events.push(event), { createBackendClient: () => backend });
    await session.handleText(JSON.stringify(start({ input: { kind: "pcm16", sampleRate: 16000, channels: 1 } })));
    expect(backend.started).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({ type: "gateway_provider_error", message: "Deepgram (DEEPGRAM_API_KEY) is not configured" }));
    gatewayConfig.VOICE_GATEWAY_ASR_PROVIDER = originalProvider;
    gatewayConfig.DEEPGRAM_API_KEY = originalKey;
  });

  it("starts text sessions through the backend client", async () => {
    const backend = new FakeBackend();
    const session = new GatewaySession("user-1", "token", () => undefined, { createBackendClient: () => backend });
    await session.handleText(JSON.stringify(start()));
    expect(backend.started).toBe(true);
    expect(session.backendSessionId).toBe("backend-session");
  });

  it("closes backend and ASR on disconnect", async () => {
    const backend = new FakeBackend();
    const asr = new FakeAsr();
    const session = new GatewaySession("user-1", "token", () => undefined, { createBackendClient: () => backend, createAsrProvider: () => asr });
    await session.handleText(JSON.stringify(start({ input: { kind: "pcm16", sampleRate: 16000, channels: 1 } })));
    await session.disconnect();
    expect(backend.closed).toBe(true);
  });

  it("forwards stop save flag to backend", async () => {
    const backend = new FakeBackend();
    const session = new GatewaySession("user-1", "token", () => undefined, { createBackendClient: () => backend });
    await session.handleText(JSON.stringify(start()));
    await session.handleText(JSON.stringify({ type: "stop", save: true }));
    expect(backend.stopSave).toBe(true);
  });

  it("ignores late ASR finals after stopped", async () => {
    const backend = new FakeBackend();
    const asr = new FakeAsr();
    const session = new GatewaySession("user-1", "token", () => undefined, { createBackendClient: () => backend, createAsrProvider: () => asr });
    await session.handleText(JSON.stringify(start({ input: { kind: "text" } })));
    await session.handleText(JSON.stringify({ type: "stop", save: false }));
    asr.emitFinal({ speaker: "speaker_1", text: "late final", isFinal: true, offsetMs: 10 });
    expect(backend.transcripts).toHaveLength(0);
  });

  it("routes conversation_agent ASR finals to user_text", async () => {
    const backend = new FakeBackend();
    const asr = new FakeAsr();
    const session = new GatewaySession("user-1", "token", () => undefined, { createBackendClient: () => backend, createAsrProvider: () => asr });
    await session.handleText(JSON.stringify(start({ policy: "conversation_agent", input: { kind: "pcm16", sampleRate: 16000, channels: 1 } })));
    asr.emitFinal({ speaker: "speaker_1", text: "What should I ask?", isFinal: true, offsetMs: 10 });
    expect(backend.userTexts).toEqual(["What should I ask?"]);
    expect(backend.transcripts).toHaveLength(0);
  });

  it("routes whisper_copilot ASR finals to transcript", async () => {
    const backend = new FakeBackend();
    const asr = new FakeAsr();
    const session = new GatewaySession("user-1", "token", () => undefined, { createBackendClient: () => backend, createAsrProvider: () => asr });
    await session.handleText(JSON.stringify(start({ policy: "whisper_copilot", input: { kind: "pcm16", sampleRate: 16000, channels: 1 } })));
    asr.emitFinal({ speaker: "speaker_1", text: "The APR is 9.4 percent.", isFinal: true, offsetMs: 10 });
    expect(backend.userTexts).toHaveLength(0);
    expect(backend.transcripts[0]?.text).toBe("The APR is 9.4 percent.");
  });
});

class FakeBackend extends EventEmitter implements BackendClientLike {
  started = false;
  closed = false;
  stopSave: boolean | null = null;
  transcripts: Array<{ speaker: string; text: string; offsetMs?: number }> = [];
  userTexts: string[] = [];

  async start(_start: GatewayStartEvent): Promise<{ sessionId: string; voiceSessionId: string }> {
    this.started = true;
    return { sessionId: "backend-session", voiceSessionId: "backend-voice-session" };
  }
  sendUserText(text: string): void {
    this.userTexts.push(text);
  }
  sendTranscript(segment: { speaker: string; text: string; offsetMs?: number }): void {
    this.transcripts.push(segment);
  }
  sendSpeechStarted(): void {}
  sendSpeechEnded(): void {}
  sendStop(save: boolean): void {
    this.stopSave = save;
  }
  close(): void {
    this.closed = true;
  }
}

class FakeAsr implements AsrProvider {
  readonly name = "deepgram" as const;
  private onFinal: ((segment: AsrSegment) => void) | null = null;
  async start(params: { onPartial: (segment: AsrSegment) => void; onFinal: (segment: AsrSegment) => void; onError: (error: Error) => void }): Promise<void> {
    this.onFinal = params.onFinal;
  }
  sendPcm(): void {}
  async stop(): Promise<void> {}
  emitFinal(segment: AsrSegment): void {
    this.onFinal?.(segment);
  }
}

function consent() {
  return { granted: true, method: "user_tap", noticeText: "Live Assist is active. I confirm consent.", participantCount: 1, jurisdiction: "unknown" };
}

function start(overrides: Record<string, unknown> = {}) {
  return {
    type: "start",
    policy: "conversation_agent",
    situationDescription: "I am going to the bank",
    title: "Bank",
    consent: consent(),
    input: { kind: "text" },
    output: { kind: "both" },
    retentionPolicy: "ask_on_stop",
    ...overrides,
  };
}
