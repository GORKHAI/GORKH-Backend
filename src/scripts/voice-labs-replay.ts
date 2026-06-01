import { gatewayConfig } from "../../services/voice-gateway/src/config.js";
import { NoneAsrProvider } from "../../services/voice-gateway/src/asr/none.js";
import { DisabledVibeVoiceAsrLabProvider } from "../../services/voice-gateway/src/labs/vibevoice/asr-provider-lab.js";
import { DisabledVibeVoiceRealtimeTtsLabProvider } from "../../services/voice-gateway/src/labs/vibevoice/realtime-tts-provider-lab.js";
import { resolveVibeVoiceLabConfig, validateSyntheticVoiceSafety } from "../../services/voice-gateway/src/labs/vibevoice/safety.js";

type Scenario = "vibevoice-config" | "vibevoice-disabled" | "tts-safety" | "production-path-unchanged";

const scenario = (process.argv[2] ?? "vibevoice-config") as Scenario;
const allowed: Scenario[] = ["vibevoice-config", "vibevoice-disabled", "tts-safety", "production-path-unchanged"];
if (!allowed.includes(scenario)) throw new Error(`unknown voice-labs replay "${scenario}"`);

if (scenario === "vibevoice-config") {
  const config = resolveVibeVoiceLabConfig();
  console.log(`vibevoice-config: ${JSON.stringify(redactConfig(config))}`);
  assert(config.voiceLabsEnabled === false, "VOICE_LABS_ENABLED must default false");
  assert(config.vibeVoiceLabEnabled === false, "VIBEVOICE_LAB_ENABLED must default false");
}

if (scenario === "vibevoice-disabled") {
  const asr = new DisabledVibeVoiceAsrLabProvider(resolveVibeVoiceLabConfig());
  const tts = new DisabledVibeVoiceRealtimeTtsLabProvider(resolveVibeVoiceLabConfig({ VIBEVOICE_ALLOW_SYNTHETIC_VOICE: "true" }));
  await expectProviderNotConfigured(() => asr.transcribeLongForm({ audioRef: "saved-session-audio-ref", consentChecked: true }));
  await expectProviderNotConfigured(async () => {
    for await (const _chunk of tts.synthesize({ textStreamId: "stream-1", disclosureRequired: true })) {
      // No chunks are expected. This path must fail before generating audio.
    }
  });
  console.log("vibevoice-disabled: provider_not_configured; no fake ASR/TTS output");
}

if (scenario === "tts-safety") {
  expectSafetyDenied(() => validateSyntheticVoiceSafety({ mode: "voice_clone", consentForSyntheticVoice: true, disclosureToUser: true }));
  expectSafetyDenied(() => validateSyntheticVoiceSafety({ mode: "impersonation", targetVoice: "public person", consentForSyntheticVoice: true, disclosureToUser: true }));
  expectSafetyDenied(() => validateSyntheticVoiceSafety({ mode: "realtime_tts", consentForSyntheticVoice: false, disclosureToUser: false }));
  console.log("tts-safety: unsafe synthetic voice modes rejected");
}

if (scenario === "production-path-unchanged") {
  const none = new NoneAsrProvider();
  assert(none.name === "none", "none ASR provider unchanged");
  assert(gatewayConfig.VOICE_GATEWAY_ASR_PROVIDER === "none" || gatewayConfig.VOICE_GATEWAY_ASR_PROVIDER === "deepgram", "gateway ASR provider remains production enum");
  assert(gatewayConfig.VOICE_GATEWAY_OUTPUT_STRATEGY === "client_tts" || gatewayConfig.VOICE_GATEWAY_OUTPUT_STRATEGY === "text_only", "gateway output strategy remains client-side/text");
  console.log(`production-path-unchanged: asr=${gatewayConfig.VOICE_GATEWAY_ASR_PROVIDER} output=${gatewayConfig.VOICE_GATEWAY_OUTPUT_STRATEGY}`);
}

function redactConfig(config: ReturnType<typeof resolveVibeVoiceLabConfig>): Record<string, unknown> {
  return {
    voiceLabsEnabled: config.voiceLabsEnabled,
    vibeVoiceLabEnabled: config.vibeVoiceLabEnabled,
    asrLabEnabled: config.asrLabEnabled,
    realtimeTtsLabEnabled: config.realtimeTtsLabEnabled,
    modelPathConfigured: Boolean(config.modelPath),
    serverUrlConfigured: Boolean(config.serverUrl),
    allowSyntheticVoice: config.allowSyntheticVoice,
    nodeEnv: config.nodeEnv,
  };
}

async function expectProviderNotConfigured(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    const body = (error as { body?: { code?: string } }).body;
    if (body?.code === "provider_not_configured") return;
    throw error;
  }
  throw new Error("expected provider_not_configured");
}

function expectSafetyDenied(fn: () => void): void {
  try {
    fn();
  } catch (error) {
    const body = (error as { body?: { code?: string } }).body;
    if (body?.code === "synthetic_voice_policy_denied") return;
    throw error;
  }
  throw new Error("expected synthetic_voice_policy_denied");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
