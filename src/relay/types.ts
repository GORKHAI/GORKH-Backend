import { z } from "zod";
import type { AgentRequestType, RiskLevel } from "../db/schema.js";

export const relayRequestTypes = [
  "intro_request",
  "meeting_request",
  "availability_request",
  "investor_interest_check",
  "job_opportunity",
  "collaboration_request",
  "team_update_request",
  "room_invite",
  "document_review_request",
  "follow_up_request",
  "general_request",
] as const;

export const relayRiskLevels = ["low", "medium", "high"] as const;

export const relayIdentityBodySchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  headline: z.string().trim().max(240).nullable().optional(),
  professionalRole: z.string().trim().max(160).nullable().optional(),
  companyName: z.string().trim().max(160).nullable().optional(),
  profileVisibility: z.enum(["private", "trusted_contacts", "public_limited"]).optional(),
  relayEnabled: z.boolean().optional(),
});

export const relayContactBodySchema = z.object({
  displayName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().nullable().optional(),
  companyName: z.string().trim().max(160).nullable().optional(),
  relationship: z.string().trim().max(160).nullable().optional(),
  trustLevel: z.enum(["low", "standard", "high"]).optional(),
});

export const relayDraftBodySchema = z.object({
  requestType: z.enum(relayRequestTypes),
  recipient: z
    .object({
      contactId: z.string().uuid().optional(),
      email: z.string().trim().email().optional(),
      displayName: z.string().trim().min(1).max(160).optional(),
    })
    .optional(),
  goal: z.string().trim().min(1).max(1000),
  context: z.record(z.unknown()).optional(),
  requestedShare: z.record(z.unknown()).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const relayDecisionBodySchema = z.object({
  reason: z.string().trim().max(500).nullable().optional(),
  approvedPayload: z.record(z.unknown()).nullable().optional(),
});

export const relayMessageBodySchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export type RelayDraftInput = z.infer<typeof relayDraftBodySchema>;
export type RelayContactInput = z.infer<typeof relayContactBodySchema>;
export type RelayIdentityInput = z.infer<typeof relayIdentityBodySchema>;
export type RelayDecisionInput = z.infer<typeof relayDecisionBodySchema>;
export type RelayMessageInput = z.infer<typeof relayMessageBodySchema>;

export interface RelayApprovalCard {
  type: "relay_request_approval";
  requestId: string;
  title: string;
  summary: string;
  confirmLabel: "Send Request";
  cancelLabel: "Cancel";
}

export function titleForRequestType(type: AgentRequestType, recipientName: string): string {
  const prefix: Record<AgentRequestType, string> = {
    intro_request: "Intro request",
    meeting_request: "Meeting request",
    availability_request: "Availability check",
    investor_interest_check: "Investor interest check",
    job_opportunity: "Job opportunity",
    collaboration_request: "Collaboration request",
    team_update_request: "Team update request",
    room_invite: "Room invite request",
    document_review_request: "Document review request",
    follow_up_request: "Follow-up request",
    general_request: "Agent request",
  };
  return `${prefix[type]} for ${recipientName}`;
}

export function riskForRequest(type: AgentRequestType, requestedShare: Record<string, unknown>): RiskLevel {
  if (type === "document_review_request" || type === "room_invite") return "high";
  if (Object.keys(requestedShare).length > 0) return "medium";
  if (type === "availability_request" || type === "meeting_request") return "low";
  return "medium";
}
