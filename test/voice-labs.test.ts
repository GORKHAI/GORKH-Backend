import { describe, expect, it } from "vitest";
import { NoneAsrProvider } from "../services/voice-gateway/src/asr/none.js";
import { DisabledVibeVoiceAsrLabProvider } from "../services/voice-gateway/src/labs/vibevoice/asr-provider-lab.js";
import { DisabledVibeVoiceRealtimeTtsLabProvider } from "../services/voice-gateway/src/labs/vibevoice/realtime-tts-provider-lab.js";
import { assertVibeVoiceLabSelectable, resolveVibeVoiceLabConfig, validateSyntheticVoiceSafety } from "../services/voice-gateway/src/labs/vibevoice/safety.js";

describe("VibeVoice provider lab", () => {
  it("defaults disabled", () => {
    const config = resolveVibeVoiceLabConfig({});
    expect(config.voiceLabsEnabled).toBe(false);
    expect(config.vibeVoiceLabEnabled).toBe(false);
    expect(config.asrLabEnabled).toBe(false);
    expect(config.realtimeTtsLabEnabled).toBe(false);
    expect(config.allowSyntheticVoice).toBe(false);
  });

  it("cannot be selected by default", () => {
    expect(() => assertVibeVoiceLabSelectable("asr", resolveVibeVoiceLabConfig({}))).toThrow(/disabled or unavailable/);
  });

  it("returns provider_not_configured when unavailable", async () => {
    const asr = new DisabledVibeVoiceAsrLabProvider(resolveVibeVoiceLabConfig({}));
    await expect(asr.transcribeLongForm({ audioRef: "saved-audio", consentChecked: true })).rejects.toMatchObject({
      body: { code: "provider_not_configured" },
    });
  });

  it("blocks lab provider in production even with lab flags", () => {
    const config = resolveVibeVoiceLabConfig({
      NODE_ENV: "production",
      VOICE_LABS_ENABLED: "true",
      VIBEVOICE_LAB_ENABLED: "true",
      VIBEVOICE_ASR_LAB_ENABLED: "true",
      VIBEVOICE_MODEL_PATH: "/models/vibevoice",
    });
    expect(() => assertVibeVoiceLabSelectable("asr", config)).toThrow(/blocked in production/);
  });

  it("rejects cloning and impersonation modes", () => {
    expect(() => validateSyntheticVoiceSafety({ mode: "voice_clone", consentForSyntheticVoice: true, disclosureToUser: true })).toThrow(/not allowed/);
    expect(() => validateSyntheticVoiceSafety({ mode: "impersonation", targetVoice: "public person", consentForSyntheticVoice: true, disclosureToUser: true })).toThrow(/not allowed/);
  });

  it("does not generate fake realtime TTS output", async () => {
    const tts = new DisabledVibeVoiceRealtimeTtsLabProvider(resolveVibeVoiceLabConfig({}));
    await expect(async () => {
      for await (const _chunk of tts.synthesize({ textStreamId: "stream", disclosureRequired: true })) {
        // No chunks should ever be produced by the disabled stub.
      }
    }).rejects.toMatchObject({ body: { code: "synthetic_voice_policy_denied" } });
  });

  it("leaves current production ASR path unchanged", () => {
    const none = new NoneAsrProvider();
    expect(none.name).toBe("none");
    expect(() => none.sendPcm()).toThrow(/ASR provider is not configured/);
  });
});
