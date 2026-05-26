import { z } from "zod";
import type { CommitmentSourceType, Sensitivity, TaskPriority } from "../db/schema.js";

export const proposedCommitmentSchema = z.object({
  sourceType: z.enum(["transcript", "user_text", "assistant_text", "document", "manual", "subagent_report"]),
  sourceId: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
  counterparty: z.string().nullable().optional(),
  title: z.string().min(1),
  detail: z.string().nullable().optional(),
  dueAt: z.date().nullable().optional(),
  confidence: z.number().min(0).max(1),
  sensitivity: z.enum(["low", "medium", "high", "sensitive"]),
});

export type ProposedCommitment = z.infer<typeof proposedCommitmentSchema>;

export interface CommitmentExtractionInput {
  text: string;
  sourceType: CommitmentSourceType;
  sourceId?: string | null;
  internalType?: string | null;
  speaker?: string | null;
  now?: Date;
}

export interface TaskProposal {
  title: string;
  detail?: string | null;
  priority: TaskPriority;
  dueAt?: Date | null;
}

export interface DailyBriefSection {
  title: string;
  items: string[];
}

export interface DailyBriefDraft {
  summary: string;
  sections: DailyBriefSection[];
  actionItems: Array<{ title: string; priority: string; dueAt?: string | null; status?: string }>;
}

export interface MeetingPackDraft {
  title: string;
  packType: "prep" | "recap";
  sections: DailyBriefSection[];
  risks: string[];
  suggestedQuestions: string[];
  followups: string[];
}

export function sensitivityForDailyText(text: string, internalType?: string | null): Sensitivity {
  if (/\b(doctor|clinic|blood test|medication|symptom|diagnosis|treatment|bank|loan|mortgage|lender|lawyer|legal|court|contract dispute)\b/i.test(text)) {
    return "medium";
  }
  if (internalType === "doctor_visit" || internalType === "legal_consultation") return "medium";
  return "low";
}
