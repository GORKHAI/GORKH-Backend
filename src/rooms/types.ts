import { z } from "zod";

export const createRoomBodySchema = z.object({
  outreachCampaignId: z.string().uuid().nullable().optional(),
  investorId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(180),
  aiAgentEnabled: z.boolean().optional(),
  transcriptionEnabled: z.boolean().optional(),
  recordingEnabled: z.boolean().optional(),
});

export const transcriptSegmentBodySchema = z.object({
  speakerLabel: z.string().min(1).max(120),
  text: z.string().min(1).max(12000),
  offsetMs: z.number().int().nonnegative().nullable().optional(),
  isFinal: z.boolean().optional(),
});

export const guestConsentBodySchema = z.object({
  consentStatus: z.enum(["granted", "denied"]).default("granted"),
  displayName: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
});

export const guestTokenBodySchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
});

export type CreateRoomBody = z.infer<typeof createRoomBodySchema>;
export type TranscriptSegmentBody = z.infer<typeof transcriptSegmentBodySchema>;
export type GuestConsentBody = z.infer<typeof guestConsentBodySchema>;

export type RoomConfigStatus = {
  enabled: boolean;
  provider: "livekit";
  configured: boolean;
  recordingEnabled: boolean;
  transcriptionEnabled: boolean;
  aiAgentEnabled: boolean;
  aiSpeakingEnabled: boolean;
  errorCode?: "rooms_disabled" | "rooms_not_configured";
};

export type LiveKitRole = "host" | "guest" | "ai_agent" | "admin";
