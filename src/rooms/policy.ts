import { config } from "../config.js";
import type { RoomConfigStatus } from "./types.js";

export function roomConfigStatus(): RoomConfigStatus {
  const configured = Boolean(config.LIVEKIT_URL && config.LIVEKIT_API_KEY && config.LIVEKIT_API_SECRET);
  return {
    enabled: config.ROOMS_ENABLED,
    provider: config.ROOMS_PROVIDER,
    configured,
    recordingEnabled: config.ROOMS_RECORDING_ENABLED,
    transcriptionEnabled: config.ROOMS_TRANSCRIPTION_ENABLED,
    aiAgentEnabled: config.ROOMS_AI_AGENT_ENABLED,
    aiSpeakingEnabled: config.ROOMS_AI_AGENT_SPEAKING_ENABLED,
    errorCode: !config.ROOMS_ENABLED ? "rooms_disabled" : configured ? undefined : "rooms_not_configured",
  };
}

export function roomsEnabledForDraftRecords(): boolean {
  // Room records and review flows are allowed in local/control-plane mode.
  // LiveKit room/token operations still require ROOMS_ENABLED and provider config.
  return true;
}

export function assertLiveKitReady(): void {
  const status = roomConfigStatus();
  if (!status.enabled) throw new RoomsPolicyError("rooms_disabled", "Nearmind Rooms are disabled.");
  if (!status.configured) throw new RoomsPolicyError("rooms_not_configured", "LiveKit is not configured for real room/token operations.");
}

export function canTranscriptAfterConsent(consentRequired: boolean, participants: Array<{ role: string; consentStatus: string }>): boolean {
  if (!consentRequired) return true;
  const humanParticipants = participants.filter((participant) => participant.role !== "ai_agent");
  return humanParticipants.length > 0 && humanParticipants.every((participant) => participant.consentStatus === "granted");
}

export class RoomsPolicyError extends Error {
  constructor(
    public readonly code: "rooms_disabled" | "rooms_not_configured" | "consent_required" | "guest_forbidden" | "room_not_found" | "room_ended",
    message: string,
  ) {
    super(message);
  }
}
