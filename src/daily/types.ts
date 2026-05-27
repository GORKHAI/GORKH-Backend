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
  effortEstimate?: string | null;
  context?: string | null;
  blockedBy?: string | null;
  nextStep?: string | null;
}

export interface DailyBriefSection {
  key?: string;
  title: string;
  items: string[];
  quality?: {
    relevanceScore?: number;
    staleItemCount?: number;
    confidence?: number;
  };
}

export interface DailyBriefDraft {
  summary: string;
  sections: DailyBriefSection[];
  actionItems: Array<{
    title: string;
    priority: string;
    dueAt?: string | null;
    status?: string;
    nextStep?: string | null;
    effortEstimate?: string | null;
    ranking?: TaskRankingExplanation;
  }>;
  quality?: DailyBriefQuality;
}

export interface DailyBriefQuality {
  briefRelevanceScore: number;
  staleItemCount: number;
  overdueItemCount: number;
  acceptedSuggestionRate: number;
  dismissedSuggestionRate: number;
  confidence: number;
}

export interface TaskRankingExplanation {
  urgencyScore: number;
  confidenceScore: number;
  riskScore: number;
  actionabilityScore: number;
  freshnessScore: number;
  dependencyScore: number;
  dismissalPenalty: number;
  totalScore: number;
}

export interface WeeklyReviewDraft {
  summary: string;
  sections: DailyBriefSection[];
  quality: {
    completedTaskCount: number;
    missedCommitmentCount: number;
    openLoopCount: number;
    confidence: number;
  };
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
