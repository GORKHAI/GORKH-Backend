import { SignJWT } from "jose";
import { gatewayConfig } from "../../services/voice-gateway/src/config.js";
import { buildGatewayServer } from "../../services/voice-gateway/src/server.js";
import { getVoiceCharacters } from "../../services/voice-gateway/src/tts/characters.js";
import { validateTtsInput } from "../../services/voice-gateway/src/tts/safety.js";
import { TtsProviderError } from "../../services/voice-gateway/src/tts/types.js";

type ReplayName = "provider-none" | "disabled" | "characters" | "safety" | "auth-required";

const replay = (process.argv[2] ?? "characters") as ReplayName;

const original = { ...gatewayConfig };
try {
  if (replay === "characters") {
    const characters = getVoiceCharacters();
    assert(characters.length === 5, "expected five NearMind voice characters");
    console.log(`tts:replay:characters ok count=${characters.length}`);
  } else if (replay === "safety") {
    expectReject("screen_only", () =>
      validateTtsInput({
        text: "Screen only report",
        voiceCharacterId: "calm_guide",
        purpose: "assistant_response",
        outputFormat: "audio/mpeg",
        deliveryTarget: "screen_only",
      }),
    );
    expectReject("impersonation", () =>
      validateTtsInput({
        text: "Clone my friend voice.",
        voiceCharacterId: "calm_guide",
        purpose: "assistant_response",
        outputFormat: "audio/mpeg",
      }),
    );
    console.log("tts:replay:safety ok");
  } else if (replay === "auth-required") {
    Object.assign(gatewayConfig, original, { JWT_SECRET: "tts-replay-secret-that-is-long-enough", NATURAL_VOICE_ENABLED: true });
    const app = await buildGatewayServer();
    const response = await app.inject({ method: "POST", url: "/tts/synthesize", payload: { text: "NearMind voice test." } });
    await app.close();
    assert(response.statusCode === 401, "expected auth-required status 401");
    console.log("tts:replay:auth-required ok");
  } else if (replay === "disabled") {
    Object.assign(gatewayConfig, original, { JWT_SECRET: "tts-replay-secret-that-is-long-enough", NATURAL_VOICE_ENABLED: false });
    const app = await buildGatewayServer();
    const response = await app.inject({
      method: "POST",
      url: "/tts/synthesize",
      headers: { Authorization: `Bearer ${await testJwt()}` },
      payload: { text: "NearMind voice test." },
    });
    await app.close();
    assert(response.statusCode === 403 && response.body.includes("natural_voice_disabled"), "expected natural_voice_disabled");
    console.log("tts:replay:disabled ok");
  } else if (replay === "provider-none") {
    Object.assign(gatewayConfig, original, { JWT_SECRET: "tts-replay-secret-that-is-long-enough", NATURAL_VOICE_ENABLED: true, TTS_PROVIDER: "none" });
    const app = await buildGatewayServer();
    const response = await app.inject({
      method: "POST",
      url: "/tts/synthesize",
      headers: { Authorization: `Bearer ${await testJwt()}` },
      payload: { text: "NearMind voice test.", voiceCharacterId: "calm_guide", purpose: "assistant_response" },
    });
    await app.close();
    assert(response.statusCode === 503 && response.body.includes("tts_provider_not_configured"), "expected tts_provider_not_configured");
    console.log("tts:replay:provider-none ok");
  } else {
    throw new Error(`unknown tts replay ${String(replay)}`);
  }
} finally {
  Object.assign(gatewayConfig, original);
}

function expectReject(name: string, fn: () => unknown): void {
  try {
    fn();
  } catch (error) {
    if (error instanceof TtsProviderError) return;
    throw error;
  }
  throw new Error(`expected ${name} to reject`);
}

async function testJwt(): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("00000000-0000-4000-8000-000000000001")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(gatewayConfig.JWT_SECRET));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
