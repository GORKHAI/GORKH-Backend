import { z } from "zod";
import type { HumanFactKind, HumanFactSource, HumanFactStatus, Sensitivity } from "../db/schema.js";

export interface ProfileFactDraft {
  kind: HumanFactKind;
  content: string;
  source: HumanFactSource;
  confidence: number;
  sensitivity: Sensitivity;
  status: HumanFactStatus;
  reason: string;
}

export interface HumanContextSummary {
  occupation: string | null;
  activeDomains: string[];
  activeProjects: string[];
  goals: string[];
  communicationPreferences: Record<string, unknown>;
  assistantPreferences: Record<string, unknown>;
  currentSituation?: string | null;
  stressSupportOptIn: boolean;
  confirmedFacts: Array<{ id: string; kind: HumanFactKind; content: string; confidence: number; sensitivity: Sensitivity }>;
  proposedFacts?: Array<{ id: string; kind: HumanFactKind; content: string; confidence: number; sensitivity: Sensitivity }>;
}

export const profileFactDraftSchema = z.object({
  kind: z.enum([
    "occupation",
    "project",
    "goal",
    "preference",
    "constraint",
    "person",
    "organization",
    "routine",
    "communication_style",
    "stress_support_preference",
    "sensitive_candidate",
  ]),
  content: z.string().min(1),
  source: z.enum(["explicit_user", "inferred", "confirmed", "imported"]),
  confidence: z.number().min(0).max(1),
  sensitivity: z.enum(["low", "medium", "high", "sensitive"]),
  status: z.enum(["proposed", "confirmed", "rejected", "expired"]),
  reason: z.string().min(1),
});
