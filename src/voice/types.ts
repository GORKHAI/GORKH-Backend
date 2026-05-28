import { z } from "zod";
import type { Cue } from "../cue/fast-cues.js";
import type { InternalType, RetentionPolicy } from "../db/schema.js";
import type { TriggerEvent } from "../trigger/classifier.js";

export const voicePolicySchema = z.enum(["conversation_agent", "whisper_copilot"]);
export const inputKindSchema = z.enum(["text", "audio_pcm16"]);
export const outputKindSchema = z.enum(["text", "tts", "both"]);
export const voiceStateSchema = z.enum(["starting", "listening", "thinking", "speaking", "stopped", "interrupted", "discarded"]);
export const retentionPolicySchema = z.enum(["save_on_stop", "discard_on_stop", "ask_on_stop"]);

export type VoicePolicy = z.infer<typeof voicePolicySchema>;
export type InputKind = z.infer<typeof inputKindSchema>;
export type OutputKind = z.infer<typeof outputKindSchema>;
export type VoiceState = z.infer<typeof voiceStateSchema>;

export const voiceConsentSchema = z.object({
  granted: z.boolean(),
  method: z.string().min(1),
  noticeText: z.string().min(1),
  participantCount: z.number().int().nonnegative().nullable().optional(),
  jurisdiction: z.string().nullable().optional(),
});

export const voiceStartSchema = z.object({
  type: z.literal("start"),
  protocolVersion: z.number().int().positive().optional(),
  policy: voicePolicySchema,
  situationBriefId: z.string().uuid().optional(),
  situationDescription: z.string().min(1).optional(),
  title: z.string().optional(),
  consent: voiceConsentSchema,
  input: z.object({ kind: inputKindSchema }),
  output: z.object({ kind: outputKindSchema }),
  retentionPolicy: retentionPolicySchema.default("ask_on_stop"),
  selfSpeakerIndex: z.number().int().nullable().optional(),
});

export const voiceUserTextSchema = z.object({
  type: z.literal("user_text"),
  text: z.string().min(1),
});

export const voiceTranscriptSchema = z.object({
  type: z.literal("transcript"),
  speaker: z.string().min(1).default("speaker_0"),
  text: z.string().min(1),
  offsetMs: z.number().int().nonnegative().default(0),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

export const voiceSpeechStartedSchema = z.object({
  type: z.literal("speech_started"),
  speechId: z.string().min(1).optional(),
  timestamp: z.string().datetime().optional(),
});

export const voiceSpeechEndedSchema = z.object({
  type: z.literal("speech_ended"),
});

export const voiceStopSchema = z.object({
  type: z.literal("stop"),
  save: z.boolean().default(false),
});

export const voiceClientEventSchema = z.discriminatedUnion("type", [
  voiceStartSchema,
  voiceUserTextSchema,
  voiceTranscriptSchema,
  voiceSpeechStartedSchema,
  voiceSpeechEndedSchema,
  voiceStopSchema,
]);

export type VoiceStartEvent = z.infer<typeof voiceStartSchema>;
export type VoiceUserTextEvent = z.infer<typeof voiceUserTextSchema>;
export type VoiceTranscriptEvent = z.infer<typeof voiceTranscriptSchema>;
export type VoiceClientEvent = z.infer<typeof voiceClientEventSchema>;
export type VoiceRetentionPolicy = RetentionPolicy;

export type VoiceServerEvent =
  | {
      type: "voice_ack";
      protocolVersion: number;
      serverProtocolVersion: number;
      sessionId: string;
      voiceSessionId: string;
      situationBriefId: string | null;
      policy: VoicePolicy;
      internalType: InternalType;
      state: VoiceState;
    }
  | { type: "voice_state"; state: VoiceState }
  | { type: "voice_segment"; speaker: string; text: string; isFinal: boolean }
  | { type: "voice_triggers"; triggers: TriggerEvent[] }
  | { type: "voice_cue"; cue: Cue; speechId: string }
  | { type: "voice_assistant_text"; text: string; speechId: string }
  | { type: "voice_speak_request"; speechId: string; text: string; delivery: Cue["delivery"] }
  | { type: "voice_tts_unavailable"; speechId: string; provider: "none"; message: string }
  | { type: "voice_cancel_speech"; speechId: string; reason: "barge_in" | "client_cancel" | "stop" }
  | { type: "voice_subagent_started"; taskId: string; kind: string; title: string }
  | { type: "voice_subagent_progress"; taskId: string; status: string; message: string }
  | { type: "voice_subagent_report"; taskId: string; kind: string; report: unknown; delivery: "silent" | "screen_only" | "main_agent_summary" }
  | { type: "voice_subagent_failed"; taskId: string; kind: string; message: string }
  | { type: "voice_warning"; code: string; message: string; details?: Record<string, unknown> }
  | { type: "summary"; storedMemoryIds: string[] }
  | { type: "error"; stage: string; message: string; code?: string; retryable?: boolean; details?: Record<string, unknown> };
