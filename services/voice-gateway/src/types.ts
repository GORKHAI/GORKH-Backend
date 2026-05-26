import { z } from "zod";

export const gatewayPolicySchema = z.enum(["conversation_agent", "whisper_copilot"]);
export const gatewayInputKindSchema = z.enum(["text", "pcm16"]);
export const gatewayOutputKindSchema = z.enum(["text", "tts", "both"]);
export const gatewayRetentionPolicySchema = z.enum(["save_on_stop", "discard_on_stop", "ask_on_stop"]);
export const gatewayStateSchema = z.enum(["idle", "starting", "connected_to_backend", "listening", "stopping", "stopped", "interrupted", "failed"]);

export type GatewayPolicy = z.infer<typeof gatewayPolicySchema>;
export type GatewayInputKind = z.infer<typeof gatewayInputKindSchema>;
export type GatewayOutputKind = z.infer<typeof gatewayOutputKindSchema>;
export type GatewayState = z.infer<typeof gatewayStateSchema>;

export const gatewayConsentSchema = z.object({
  granted: z.boolean(),
  method: z.string().min(1),
  noticeText: z.string().min(1),
  participantCount: z.number().int().nonnegative().nullable().optional(),
  jurisdiction: z.string().nullable().optional(),
});

const textInputSchema = z.object({ kind: z.literal("text") });
const pcmInputSchema = z.object({
  kind: z.literal("pcm16"),
  sampleRate: z.literal(16000),
  channels: z.literal(1),
});

export const gatewayStartSchema = z.object({
  type: z.literal("start"),
  policy: gatewayPolicySchema,
  situationBriefId: z.string().uuid().optional(),
  situationDescription: z.string().min(1).optional(),
  title: z.string().optional(),
  consent: gatewayConsentSchema,
  input: z.discriminatedUnion("kind", [textInputSchema, pcmInputSchema]),
  output: z.object({ kind: gatewayOutputKindSchema }),
  retentionPolicy: gatewayRetentionPolicySchema.default("ask_on_stop"),
});

export const gatewayUserTextSchema = z.object({
  type: z.literal("user_text"),
  text: z.string().min(1),
});

export const gatewayTranscriptSchema = z.object({
  type: z.literal("transcript"),
  speaker: z.string().min(1).default("speaker_0"),
  text: z.string().min(1),
  offsetMs: z.number().int().nonnegative().default(0),
});

export const gatewaySpeechStartedSchema = z.object({ type: z.literal("speech_started") });
export const gatewaySpeechEndedSchema = z.object({ type: z.literal("speech_ended") });
export const gatewayStopSchema = z.object({
  type: z.literal("stop"),
  save: z.boolean().default(false),
});

export const gatewayClientEventSchema = z.discriminatedUnion("type", [
  gatewayStartSchema,
  gatewayUserTextSchema,
  gatewayTranscriptSchema,
  gatewaySpeechStartedSchema,
  gatewaySpeechEndedSchema,
  gatewayStopSchema,
]);

export type GatewayStartEvent = z.infer<typeof gatewayStartSchema>;
export type GatewayUserTextEvent = z.infer<typeof gatewayUserTextSchema>;
export type GatewayTranscriptEvent = z.infer<typeof gatewayTranscriptSchema>;
export type GatewayStopEvent = z.infer<typeof gatewayStopSchema>;
export type GatewayClientEvent = z.infer<typeof gatewayClientEventSchema>;

export interface BackendVoiceAck {
  type: "voice_ack";
  sessionId: string;
  voiceSessionId: string;
  situationBriefId: string | null;
  policy: GatewayPolicy;
  internalType: string;
  state: string;
}

export type BackendVoiceEvent = { type: string; [key: string]: unknown };

export type GatewayServerEvent =
  | {
      type: "gateway_ack";
      gatewaySessionId: string;
      backendSessionId: string;
      backendVoiceSessionId: string;
      policy: GatewayPolicy;
      inputKind: GatewayInputKind;
      outputKind: GatewayOutputKind;
      asrProvider: "none" | "deepgram";
      outputStrategy: "client_tts" | "text_only";
    }
  | { type: "gateway_state"; state: GatewayState | "connected_to_backend" }
  | { type: "gateway_provider_error"; stage: "asr"; message: string }
  | { type: "gateway_asr_partial"; speaker: string; text: string }
  | { type: "gateway_asr_final"; speaker: string; text: string; offsetMs?: number }
  | { type: "gateway_client_tts_instruction"; speechId: string; text: string; delivery: string; sourceEvent: "voice_speak_request"; maxWords?: number }
  | {
      type: "gateway_metrics";
      latencyMs: {
        gatewayToAsrFinal?: number;
        gatewayToBackend?: number;
        backendToGateway?: number;
        gatewayToClientTtsInstruction?: number;
        clientToGateway?: number;
      };
    }
  | { type: "gateway_error"; stage: string; message: string }
  | BackendVoiceEvent;
