import { z } from "zod";
import type { VibeVoiceLabConfig, VibeVoiceLabKind } from "./types.js";
import { VibeVoiceLabProviderError } from "./types.js";

const booleanFromEnv = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "on", "enabled"].includes(value.trim().toLowerCase());
};

export const syntheticVoiceRequestSchema = z.object({
  mode: z.enum(["native_tts", "realtime_tts", "voice_clone", "impersonation"]),
  targetVoice: z.string().optional(),
  consentForSyntheticVoice: z.boolean().default(false),
  disclosureToUser: z.boolean().default(false),
});

export type SyntheticVoiceRequest = z.infer<typeof syntheticVoiceRequestSchema>;

export function resolveVibeVoiceLabConfig(env: NodeJS.ProcessEnv = process.env): VibeVoiceLabConfig {
  return {
    voiceLabsEnabled: booleanFromEnv(env.VOICE_LABS_ENABLED),
    vibeVoiceLabEnabled: booleanFromEnv(env.VIBEVOICE_LAB_ENABLED),
    asrLabEnabled: booleanFromEnv(env.VIBEVOICE_ASR_LAB_ENABLED),
    realtimeTtsLabEnabled: booleanFromEnv(env.VIBEVOICE_REALTIME_TTS_LAB_ENABLED),
    modelPath: emptyToUndefined(env.VIBEVOICE_MODEL_PATH),
    serverUrl: emptyToUndefined(env.VIBEVOICE_SERVER_URL),
    allowSyntheticVoice: booleanFromEnv(env.VIBEVOICE_ALLOW_SYNTHETIC_VOICE),
    nodeEnv: env.NODE_ENV ?? "development",
  };
}

export function assertVibeVoiceLabSelectable(kind: VibeVoiceLabKind, config = resolveVibeVoiceLabConfig()): void {
  const kindEnabled = kind === "asr" ? config.asrLabEnabled : config.realtimeTtsLabEnabled;
  const hasRuntimeTarget = Boolean(config.modelPath || config.serverUrl);
  if (!config.voiceLabsEnabled || !config.vibeVoiceLabEnabled || !kindEnabled || !hasRuntimeTarget) {
    throw new VibeVoiceLabProviderError({
      code: "provider_not_configured",
      message: "VibeVoice lab provider is disabled or unavailable.",
      retryable: false,
      details: {
        voiceLabsEnabled: config.voiceLabsEnabled,
        vibeVoiceLabEnabled: config.vibeVoiceLabEnabled,
        kind,
        kindEnabled,
        modelPathConfigured: Boolean(config.modelPath),
        serverUrlConfigured: Boolean(config.serverUrl),
      },
    });
  }
  if (config.nodeEnv === "production") {
    throw new VibeVoiceLabProviderError({
      code: "provider_not_configured",
      message: "VibeVoice lab provider is blocked in production.",
      retryable: false,
      details: { kind, productionBlocked: true },
    });
  }
}

export function validateSyntheticVoiceSafety(request: SyntheticVoiceRequest, config = resolveVibeVoiceLabConfig()): void {
  if (request.mode === "voice_clone" || request.mode === "impersonation") {
    throw new VibeVoiceLabProviderError({
      code: "synthetic_voice_policy_denied",
      message: "Voice cloning and impersonation are not allowed.",
      retryable: false,
      details: { mode: request.mode },
    });
  }
  if (request.mode === "realtime_tts" && (!config.allowSyntheticVoice || !request.consentForSyntheticVoice || !request.disclosureToUser)) {
    throw new VibeVoiceLabProviderError({
      code: "synthetic_voice_policy_denied",
      message: "Synthetic voice lab use requires explicit consent, disclosure, and lab policy enablement.",
      retryable: false,
      details: {
        allowSyntheticVoice: config.allowSyntheticVoice,
        consentForSyntheticVoice: request.consentForSyntheticVoice,
        disclosureToUser: request.disclosureToUser,
      },
    });
  }
}

function emptyToUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}
