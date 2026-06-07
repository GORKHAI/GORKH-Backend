import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gatewayConfig } from "../src/config.js";
import { buildGatewayServer } from "../src/server.js";
import { getVoiceCharacters } from "../src/tts/characters.js";
import { validateTtsInput } from "../src/tts/safety.js";
import { TtsProviderError } from "../src/tts/types.js";

describe("gateway Natural Voice TTS", () => {
  const originalConfig = { ...gatewayConfig };

  beforeEach(() => {
    Object.assign(gatewayConfig, originalConfig, {
      JWT_SECRET: "gateway-tts-test-secret-that-is-long-enough",
      NATURAL_VOICE_ENABLED: false,
      TTS_PROVIDER: "none",
      DEEPGRAM_API_KEY: undefined,
      DEEPGRAM_TTS_VOICE_CALM: undefined,
      DEEPGRAM_TTS_VOICE_PROFESSIONAL: undefined,
      DEEPGRAM_TTS_VOICE_WARM: undefined,
      DEEPGRAM_TTS_VOICE_WHISPER: undefined,
      DEEPGRAM_TTS_VOICE_BRIEFING: undefined,
    });
  });

  afterEach(() => {
    Object.assign(gatewayConfig, originalConfig);
  });

  it("registers five safe voice characters", () => {
    const characters = getVoiceCharacters();
    expect(characters.map((character) => character.id)).toEqual(["calm_guide", "professional", "warm_support", "focus_whisper", "briefing_voice"]);
    expect(characters.every((character) => !/clone|celebrity|impersonate/i.test(`${character.displayName} ${character.description}`))).toBe(true);
  });

  it("rejects screen-only and overly long whisper requests", () => {
    expect(() =>
      validateTtsInput({
        text: "Detailed report",
        voiceCharacterId: "calm_guide",
        purpose: "assistant_response",
        outputFormat: "audio/mpeg",
        deliveryTarget: "screen_only",
      }),
    ).toThrow(TtsProviderError);

    expect(() =>
      validateTtsInput({
        text: "a".repeat(gatewayConfig.TTS_WHISPER_MAX_TEXT_CHARS + 1),
        voiceCharacterId: "focus_whisper",
        purpose: "whisper_cue",
        outputFormat: "audio/mpeg",
      }),
    ).toThrow(TtsProviderError);
  });

  it("rejects unsafe impersonation wording", () => {
    expect(() =>
      validateTtsInput({
        text: "Please clone my boss voice.",
        voiceCharacterId: "calm_guide",
        purpose: "assistant_response",
        outputFormat: "audio/mpeg",
      }),
    ).toThrow(/does not clone or imitate/);
  });

  it("requires auth for /tts/synthesize", async () => {
    gatewayConfig.NATURAL_VOICE_ENABLED = true;
    const app = await buildGatewayServer();
    const response = await app.inject({ method: "POST", url: "/tts/synthesize", payload: { text: "NearMind voice test." } });
    await app.close();

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "auth_missing" });
  });

  it("returns natural_voice_disabled when disabled", async () => {
    const app = await buildGatewayServer();
    const response = await app.inject({
      method: "POST",
      url: "/tts/synthesize",
      headers: { Authorization: `Bearer ${await testJwt()}` },
      payload: { text: "NearMind voice test.", voiceCharacterId: "calm_guide", purpose: "assistant_response" },
    });
    await app.close();

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "natural_voice_disabled", retryable: false });
  });

  it("returns provider none as not configured", async () => {
    gatewayConfig.NATURAL_VOICE_ENABLED = true;
    gatewayConfig.TTS_PROVIDER = "none";
    const app = await buildGatewayServer();
    const response = await app.inject({
      method: "POST",
      url: "/tts/synthesize",
      headers: { Authorization: `Bearer ${await testJwt()}` },
      payload: { text: "NearMind voice test.", voiceCharacterId: "calm_guide", purpose: "assistant_response" },
    });
    await app.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ code: "tts_provider_not_configured" });
  });

  it("does not expose provider keys in /providers", async () => {
    gatewayConfig.NATURAL_VOICE_ENABLED = true;
    gatewayConfig.TTS_PROVIDER = "deepgram_aura";
    gatewayConfig.DEEPGRAM_API_KEY = "dg_test_secret_should_not_appear";
    gatewayConfig.DEEPGRAM_TTS_VOICE_CALM = "aura-2-asteria-en";
    const app = await buildGatewayServer();
    const response = await app.inject({ method: "GET", url: "/providers" });
    await app.close();

    expect(response.statusCode).toBe(200);
    const body = response.body;
    expect(body).toContain('"selectedProvider":"deepgram_aura"');
    expect(body).not.toContain("dg_test_secret_should_not_appear");
    expect(response.json().tts.characters[0]).toMatchObject({ id: "calm_guide", configured: true });
  });
});

async function testJwt(): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("00000000-0000-4000-8000-000000000001")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(gatewayConfig.JWT_SECRET));
}
