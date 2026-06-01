import { z } from "zod";

export const createOutreachCampaignSchema = z.object({
  name: z.string().min(1),
  startupSummary: z.string().min(20),
  raiseTarget: z.string().nullable().optional(),
  targetStage: z.string().nullable().optional(),
  targetGeography: z.string().nullable().optional(),
  sectors: z.array(z.string().min(1)).default([]),
  complianceBasis: z.string().nullable().optional(),
});

export const investorResearchInputSchema = z.object({
  startupSummary: z.string().min(10).optional(),
  sector: z.string().min(1).optional(),
  geography: z.string().min(1).optional(),
  stage: z.string().min(1).optional(),
  raiseTarget: z.string().min(1).optional(),
  traction: z.string().min(1).optional(),
  targetInvestorType: z.string().min(1).optional(),
  maxResults: z.number().int().min(1).max(10).optional(),
  forceNoProvider: z.boolean().optional(),
});

export const draftEmailsBodySchema = z.object({
  investorIds: z.array(z.string().uuid()).optional(),
  senderIdentity: z.string().min(1).default("Founder of GORKH/Nearmind"),
  ask: z.string().min(1).default("Would you be open to a short introductory call?"),
});

export type CreateOutreachCampaignInput = z.infer<typeof createOutreachCampaignSchema>;
export type InvestorResearchInput = z.infer<typeof investorResearchInputSchema>;
export type DraftEmailsInput = z.infer<typeof draftEmailsBodySchema>;

export interface InvestorFitResult {
  fitScore: number;
  fitReasons: string[];
  riskFlags: string[];
  confidence: number;
}

export interface OutreachComplianceResult {
  ok: boolean;
  notes: string[];
  blockedReasons: string[];
}
