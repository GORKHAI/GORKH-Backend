import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { GatewaySession, type BackendClientLike } from "../src/session.js";
import type { GatewayStartEvent } from "../src/types.js";

describe("gateway output policy", () => {
  it("creates client TTS instructions from voice_speak_request", async () => {
    const backend = new FakeBackend();
    const events: Array<{ type: string; [key: string]: unknown }> = [];
    const session = new GatewaySession("user-1", "token", (event) => events.push(event), { createBackendClient: () => backend });
    await session.handleText(JSON.stringify(start()));
    backend.emit("event", { type: "voice_speak_request", speechId: "speech-1", text: " Ask total repayment. ", delivery: "earbud" });
    expect(events).toContainEqual(expect.objectContaining({ type: "voice_speak_request", speechId: "speech-1" }));
    expect(events).toContainEqual(
      expect.objectContaining({ type: "gateway_client_tts_instruction", speechId: "speech-1", text: "Ask total repayment.", delivery: "earbud" }),
    );
  });

  it("forwards voice_cancel_speech", async () => {
    const backend = new FakeBackend();
    const events: Array<{ type: string; [key: string]: unknown }> = [];
    const session = new GatewaySession("user-1", "token", (event) => events.push(event), { createBackendClient: () => backend });
    await session.handleText(JSON.stringify(start()));
    backend.emit("event", { type: "voice_cancel_speech", speechId: "speech-1", reason: "barge_in" });
    expect(events).toContainEqual(expect.objectContaining({ type: "voice_cancel_speech", speechId: "speech-1", reason: "barge_in" }));
  });

  it("does not create fake audio events", async () => {
    const backend = new FakeBackend();
    const events: Array<{ type: string; [key: string]: unknown }> = [];
    const session = new GatewaySession("user-1", "token", (event) => events.push(event), { createBackendClient: () => backend });
    await session.handleText(JSON.stringify(start()));
    backend.emit("event", { type: "voice_speak_request", speechId: "speech-1", text: "Ask total repayment.", delivery: "earbud" });
    expect(events.some((event) => String(event.type).includes("audio"))).toBe(false);
  });

  it("does not modify speech text except trimming", async () => {
    const backend = new FakeBackend();
    const events: Array<{ type: string; [key: string]: unknown }> = [];
    const session = new GatewaySession("user-1", "token", (event) => events.push(event), { createBackendClient: () => backend });
    await session.handleText(JSON.stringify(start()));
    backend.emit("event", { type: "voice_speak_request", speechId: "speech-1", text: "  Get it in writing.  ", delivery: "earbud" });
    const instruction = events.find((event) => event.type === "gateway_client_tts_instruction");
    expect(instruction?.text).toBe("Get it in writing.");
  });
});

class FakeBackend extends EventEmitter implements BackendClientLike {
  async start(_start: GatewayStartEvent): Promise<{ sessionId: string; voiceSessionId: string }> {
    return { sessionId: "backend-session", voiceSessionId: "backend-voice-session" };
  }
  sendUserText(): void {}
  sendTranscript(): void {}
  sendSpeechStarted(): void {}
  sendSpeechEnded(): void {}
  sendStop(): void {}
  close(): void {}
}

function start() {
  return {
    type: "start",
    policy: "whisper_copilot",
    situationDescription: "bank loan",
    consent: {
      granted: true,
      method: "user_tap",
      noticeText: "Live Assist is active. I confirm consent.",
      participantCount: 2,
      jurisdiction: "unknown",
    },
    input: { kind: "text" },
    output: { kind: "both" },
    retentionPolicy: "ask_on_stop",
  };
}
