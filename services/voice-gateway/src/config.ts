import "dotenv/config";
import { z } from "zod";

const gatewayEnvSchema = z.object({
  VOICE_GATEWAY_HOST: z.string().min(1).default("0.0.0.0"),
  VOICE_GATEWAY_PORT: z.coerce.number().int().positive().default(3010),
  GORKH_BACKEND_HTTP_URL: z.string().url().default("http://127.0.0.1:3000"),
  GORKH_BACKEND_WS_URL: z.string().url().default("ws://127.0.0.1:3000"),
  JWT_SECRET: z.string().min(16).optional(),
  VOICE_GATEWAY_ASR_PROVIDER: z.enum(["none", "deepgram"]).default("none"),
  VOICE_GATEWAY_OUTPUT_STRATEGY: z.enum(["client_tts", "text_only"]).default("client_tts"),
  DEEPGRAM_API_KEY: emptyToUndefined(z.string().min(1).optional()),
  DEEPGRAM_MODEL: z.string().min(1).default("nova-3"),
  GATEWAY_MAX_PCM_FRAME_BYTES: z.coerce.number().int().positive().default(64000),
  GATEWAY_SESSION_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  GATEWAY_BACKEND_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  OPS_CONSOLE_ENABLED: z.coerce.boolean().default(false),
  OPS_CONSOLE_ADMIN_TOKEN: emptyToUndefined(z.string().min(16).optional()),
  OPS_CONSOLE_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
});

function emptyToUndefined<T extends z.ZodTypeAny>(schema: T): z.ZodEffects<T, z.output<T>, unknown> {
  return z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), schema);
}

export type GatewayConfig = z.infer<typeof gatewayEnvSchema>;
export type GatewayAsrProviderName = GatewayConfig["VOICE_GATEWAY_ASR_PROVIDER"];
export type GatewayOutputStrategy = GatewayConfig["VOICE_GATEWAY_OUTPUT_STRATEGY"];

const gatewayEnv = {
  ...process.env,
  VOICE_GATEWAY_PORT: process.env.VOICE_GATEWAY_PORT ?? process.env.PORT,
};

export const gatewayConfig: GatewayConfig = gatewayEnvSchema.parse(gatewayEnv);

export function requireGatewayKey(value: string | undefined, label: string): string {
  if (!value || value.trim() === "") throw new Error(`${label} is not configured`);
  return value;
}

export function validateGatewayBootConfig(): void {
  requireGatewayKey(gatewayConfig.JWT_SECRET, "JWT_SECRET");
}

export function isAsrAvailable(): boolean {
  if (gatewayConfig.VOICE_GATEWAY_ASR_PROVIDER === "none") return false;
  if (gatewayConfig.VOICE_GATEWAY_ASR_PROVIDER === "deepgram") return Boolean(gatewayConfig.DEEPGRAM_API_KEY);
  return false;
}

export function asrUnavailableMessage(): string {
  if (gatewayConfig.VOICE_GATEWAY_ASR_PROVIDER === "deepgram" && !gatewayConfig.DEEPGRAM_API_KEY) {
    return "Deepgram (DEEPGRAM_API_KEY) is not configured";
  }
  return "ASR provider is not configured for pcm16 input.";
}
