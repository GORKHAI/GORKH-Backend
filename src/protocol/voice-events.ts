export const mobileVoiceEventTypes = [
  "voice_ack",
  "voice_state",
  "voice_segment",
  "voice_triggers",
  "voice_cue",
  "voice_assistant_text",
  "voice_speak_request",
  "voice_tts_unavailable",
  "voice_cancel_speech",
  "voice_subagent_started",
  "voice_subagent_progress",
  "voice_subagent_report",
  "voice_subagent_failed",
  "voice_warning",
  "summary",
  "error",
] as const;

export type MobileVoiceEventType = (typeof mobileVoiceEventTypes)[number];
