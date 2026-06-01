import { config } from "../config.js";
import { db } from "../db/client.js";
import { commitments, investorProfiles, outreachCampaigns, taskItems, type InternalType } from "../db/schema.js";
import { and, desc, eq, inArray } from "drizzle-orm";
import { createActionProposal } from "../actions/proposal.js";
import { buildDailyBriefDraft } from "../daily/daily-brief.js";
import { extractCommitmentsFromText } from "../daily/commitment-extractor.js";
import { proposeTasksForCommitments } from "../daily/task-inbox.js";
import { generateWeeklyReview } from "../daily/weekly-review.js";
import { createLlmProvider } from "../llm/provider.js";
import { LlmProviderError, type LlmProvider } from "../llm/types.js";
import { assertGovernorBudgetAvailable, GovernorBudgetExceededError, recordProviderUsage } from "../governor/budget.js";
import { routeWork } from "../governor/router.js";
import { summarizeHumanContext } from "../human/profile.js";
import { createOutreachCampaign } from "../outreach/campaign.js";
import { campaignQualitySummary } from "../outreach/quality.js";
import { adaptTextToUser } from "../personalization/adaptation.js";
import { detectResearchNeed } from "../research/need-detector.js";
import { getPlaybooks, safetyBoundariesFor } from "../situation/playbooks.js";
import { isStressSupportRequest } from "../stress/detector.js";
import { generateStressSupport } from "../stress/support.js";
import { startSubagentTask } from "../subagents/orchestrator.js";
import { prepareAssistantTextForPolicy } from "./policy.js";
import type { VoicePolicy } from "./types.js";

export interface VoiceAgentResult {
  kind: "assistant_text" | "provider_not_configured";
  text?: string;
  message?: string;
}

export function isPreparationRequest(text: string): boolean {
  return /\b(prepare me|what should i ask|red flags?|help me before|brief me|before (this|the).{0,40}(meeting|appointment|call|conversation))\b/i.test(text);
}

export async function answerVoiceUserText(input: {
  text: string;
  internalType: InternalType;
  policy: VoicePolicy;
  llmProvider?: LlmProvider;
  userId?: string;
  sessionId?: string | null;
}): Promise<VoiceAgentResult> {
  const humanContext = input.userId ? await summarizeHumanContext(input.userId).catch(() => null) : null;
  if (input.userId && isStressSupportRequest(input.text)) {
    const support = await generateStressSupport({ userId: input.userId, sessionId: input.sessionId ?? null, text: input.text, allowTransientWithoutOptIn: true });
    return { kind: "assistant_text", text: prepareAssistantTextForPolicy(support.content, input.policy) };
  }

  if (input.userId && isDailyBriefRequest(input.text)) {
    const draft = await buildDailyBriefDraft(input.userId);
    return { kind: "assistant_text", text: prepareAssistantTextForPolicy(adaptTextToUser(formatDailyBriefForVoice(draft), humanContext), input.policy) };
  }

  if (input.userId && isWaitingOnRequest(input.text)) {
    const rows = await db
      .select()
      .from(commitments)
      .where(and(eq(commitments.userId, input.userId), inArray(commitments.status, ["proposed", "confirmed", "overdue"])))
      .orderBy(desc(commitments.createdAt))
      .limit(20);
    const waiting = rows.filter((row) => row.owner && !["me", "we"].includes(row.owner));
    const text = waiting.length ? `Waiting on: ${waiting.map((row) => `${row.owner}: ${row.title}`).join("; ")}.` : "No waiting-on-others items are currently tracked.";
    return { kind: "assistant_text", text: prepareAssistantTextForPolicy(adaptTextToUser(text, humanContext), input.policy) };
  }

  if (input.userId && isMakeDayEasierRequest(input.text)) {
    const rows = await db
      .select()
      .from(taskItems)
      .where(and(eq(taskItems.userId, input.userId), inArray(taskItems.status, ["proposed", "accepted", "scheduled", "waiting", "blocked"])))
      .orderBy(desc(taskItems.suggestedAt))
      .limit(20);
    const easy = rows.filter((row) => row.effortEstimate?.includes("5-15") || row.priority === "low").slice(0, 3);
    const text = easy.length ? `Low-effort plan: ${easy.map((row) => row.nextStep ?? row.title).join("; ")}.` : "Make the day easier by picking one small admin task, confirming one deadline, and dismissing stale suggestions.";
    return { kind: "assistant_text", text: prepareAssistantTextForPolicy(adaptTextToUser(text, humanContext), input.policy) };
  }

  if (input.userId && isWeeklyReviewRequest(input.text)) {
    const review = await generateWeeklyReview(input.userId);
    return { kind: "assistant_text", text: prepareAssistantTextForPolicy(adaptTextToUser(review.summary, humanContext), input.policy) };
  }

  if (input.policy === "whisper_copilot" && isActionIntentRequest(input.text)) {
    return {
      kind: "assistant_text",
      text: prepareAssistantTextForPolicy("No action proposal during live assist. Save the session, then review actions afterward.", input.policy),
    };
  }

  if (input.userId && isInvestorListReviewRequest(input.text)) {
    const campaign = await latestOutreachCampaign(input.userId);
    if (!campaign) return { kind: "assistant_text", text: prepareAssistantTextForPolicy("No investor outreach campaign is available yet.", input.policy) };
    const summary = await campaignQualitySummary(input.userId, campaign.id);
    const text = summary
      ? `Investor list review: ${summary.leadCount} leads, ${summary.shortlistedCount} shortlisted, ${summary.duplicateCandidates} duplicate candidates, average fit ${summary.averageFitScore ?? "unknown"}, missing contacts ${summary.missingContactCount}. Next: ${summary.recommendedNextActions[0]}`
      : "Investor quality summary is unavailable.";
    return { kind: "assistant_text", text: prepareAssistantTextForPolicy(adaptTextToUser(text, humanContext), input.policy) };
  }

  if (input.userId && isStrongestInvestorRequest(input.text)) {
    const campaign = await latestOutreachCampaign(input.userId);
    if (!campaign) return { kind: "assistant_text", text: prepareAssistantTextForPolicy("No investor outreach campaign is available yet.", input.policy) };
    const rows = await db
      .select()
      .from(investorProfiles)
      .where(and(eq(investorProfiles.userId, input.userId), eq(investorProfiles.campaignId, campaign.id), inArray(investorProfiles.duplicateStatus, ["unique", "candidate_duplicate"])))
      .orderBy(desc(investorProfiles.fitScore), desc(investorProfiles.sourceConfidence))
      .limit(3);
    const text = rows.length
      ? `Strongest investors by fit/source confidence: ${rows.map((row) => `${row.firmName} (${row.fitScore ?? "unscored"}): ${(row.fitReasons as string[]).slice(0, 2).join(", ")}`).join("; ")}. Review sources before outreach.`
      : "No investor leads are available yet.";
    return { kind: "assistant_text", text: prepareAssistantTextForPolicy(adaptTextToUser(text, humanContext), input.policy) };
  }

  if (input.policy === "whisper_copilot" && isInvestorOutreachRequest(input.text)) {
    return {
      kind: "assistant_text",
      text: prepareAssistantTextForPolicy("Investor outreach is screen-only after the session.", input.policy),
    };
  }

  if (input.userId && isInvestorOutreachRequest(input.text)) {
    const campaign = await createOutreachCampaign(input.userId, {
      name: "Voice investor outreach",
      startupSummary: input.text,
      sectors: inferOutreachSectors(input.text),
      targetStage: inferOutreachStage(input.text),
      targetGeography: inferOutreachGeography(input.text),
      raiseTarget: inferRaiseTarget(input.text),
      complianceBasis: "Draft-only investor outreach. No email sending, form submission, or connector write action is enabled.",
    });
    const task = await startSubagentTask({
      userId: input.userId,
      input: {
        kind: "investor_research",
        trigger: "user_request",
        priority: "normal",
        sessionId: input.sessionId ?? null,
        input: {
          campaignId: campaign.id,
          researchInput: {
            startupSummary: campaign.startupSummary,
            sector: campaign.sectors.join(" "),
            geography: campaign.targetGeography ?? undefined,
            stage: campaign.targetStage ?? undefined,
            raiseTarget: campaign.raiseTarget ?? undefined,
            targetInvestorType: "venture capital investors",
          },
        },
        policy: {
          allowResearch: true,
          allowProfileContext: false,
          allowMemory: false,
          allowStressSupport: false,
          allowUserFacingReport: true,
          liveDelivery: "screen_only",
        },
      },
    });
    return {
      kind: "assistant_text",
      text: prepareAssistantTextForPolicy(
        `I created a draft investor outreach campaign (${campaign.id}) and started source-backed research in the background (${task.id}). No emails will be sent.`,
        input.policy,
      ),
    };
  }

  if (input.userId && isDraftFollowupActionRequest(input.text)) {
    const proposal = await createActionProposal(input.userId, {
      sessionId: input.sessionId ?? null,
      sourceType: "voice",
      actionType: input.text.toLowerCase().includes("email") ? "draft_email" : "draft_followup_message",
      title: "Draft follow-up message",
      description: "Draft a follow-up message for review. No message will be sent by GORKH.",
      payload: {
        draftIntent: input.text,
        connectorRequired: input.text.toLowerCase().includes("email") ? "google_gmail_or_outlook" : null,
        sendDisabled: true,
      },
    });
    return {
      kind: "assistant_text",
      text: prepareAssistantTextForPolicy(`I created a draft-only action proposal (${proposal.id}). Review it before using it. Sending is disabled in v0.`, input.policy),
    };
  }

  if (input.userId && isScheduleMeetingRequest(input.text)) {
    const proposal = await createActionProposal(input.userId, {
      sessionId: input.sessionId ?? null,
      sourceType: "voice",
      actionType: "propose_calendar_event",
      title: "Propose calendar event",
      description: "Prepare a calendar event proposal for review. No meeting will be created by GORKH.",
      payload: { requestText: input.text, createCalendarEventDisabled: true },
    });
    return {
      kind: "assistant_text",
      text: prepareAssistantTextForPolicy(`I created a calendar proposal (${proposal.id}) for review. Calendar creation is disabled until a connector is configured and approved.`, input.policy),
    };
  }

  if (input.userId && isSendRequest(input.text)) {
    const proposal = await createActionProposal(input.userId, {
      sessionId: input.sessionId ?? null,
      sourceType: "voice",
      actionType: "draft_followup_message",
      title: "Review message before sending",
      description: "GORKH cannot send messages in v0. This proposal records the send request for review only.",
      payload: { requestText: input.text, sendDisabled: true },
    });
    return {
      kind: "assistant_text",
      text: prepareAssistantTextForPolicy(`I cannot send it. I created a review-only draft proposal (${proposal.id}); external sending is disabled in v0.`, input.policy),
    };
  }

  if (input.userId && isReminderActionRequest(input.text)) {
    const proposal = await createActionProposal(input.userId, {
      sessionId: input.sessionId ?? null,
      sourceType: "voice",
      actionType: "propose_reminder",
      title: "Reminder proposal",
      description: "Create an internal reminder/task proposal for review.",
      payload: { title: cleanReminderTitle(input.text), detail: input.text, priority: "normal" },
    });
    return {
      kind: "assistant_text",
      text: prepareAssistantTextForPolicy(`I proposed an internal reminder (${proposal.id}). Approve and execute it before treating it as active.`, input.policy),
    };
  }

  if (input.userId && isOpenCommitmentsRequest(input.text)) {
    const rows = await db
      .select()
      .from(commitments)
      .where(and(eq(commitments.userId, input.userId), inArray(commitments.status, ["proposed", "confirmed", "overdue"])))
      .orderBy(desc(commitments.createdAt))
      .limit(8);
    const text = rows.length ? `Open commitments: ${rows.map((row) => row.title).join("; ")}.` : "No open commitments are currently proposed or confirmed.";
    return { kind: "assistant_text", text: prepareAssistantTextForPolicy(adaptTextToUser(text, humanContext), input.policy) };
  }

  if (input.userId && isRememberTaskRequest(input.text)) {
    const proposed = extractCommitmentsFromText({
      text: input.text,
      sourceType: "user_text",
      sourceId: input.sessionId ?? null,
      internalType: input.internalType,
    });
    if (proposed.length > 0) {
      const inserted = await db
        .insert(commitments)
        .values(
          proposed.map((item) => ({
            userId: input.userId!,
            sessionId: input.sessionId ?? null,
            sourceType: item.sourceType,
            sourceId: item.sourceId ?? null,
            owner: item.owner ?? null,
            counterparty: item.counterparty ?? null,
            title: item.title,
            detail: item.detail ?? null,
            dueAt: item.dueAt ?? null,
            status: "proposed" as const,
            confidence: item.confidence,
            sensitivity: item.sensitivity,
            dedupeKey: item.dedupeKey ?? null,
            whySuggested: item.whySuggested ?? null,
            sourceQuote: item.sourceQuote ?? null,
            extractionConfidence: item.extractionConfidence ?? item.confidence,
            duplicateOfId: item.duplicateOfId ?? null,
            reviewReason: item.reviewReason ?? null,
          })),
        )
        .returning();
      await proposeTasksForCommitments(inserted);
      return {
        kind: "assistant_text",
        text: prepareAssistantTextForPolicy(`I proposed ${inserted.length} task${inserted.length === 1 ? "" : "s"} for your inbox. Review and accept before treating them as active.`, input.policy),
      };
    }
  }

  if (isPreparationRequest(input.text)) {
    return {
      kind: "assistant_text",
      text: prepareAssistantTextForPolicy(adaptTextToUser(deterministicPreparation(input.internalType, humanContext?.occupation ?? null), humanContext), input.policy),
    };
  }

  try {
    const researchNeed = detectResearchNeed({ text: input.text, internalType: input.internalType, livePolicy: input.policy });
    const decision = routeWork({
      deterministicAvailable: false,
      needsResearch: researchNeed.needsResearch,
      operation: input.policy === "whisper_copilot" ? "whisper_cue" : "open_chat",
    });
    if (!decision.allowed && decision.errorCode === "provider_budget_exceeded") {
      return { kind: "provider_not_configured", message: "provider_budget_exceeded" };
    }
    await assertGovernorBudgetAvailable(input.userId, "llm");
    const provider = input.llmProvider ?? createLlmProvider();
    const startedAt = Date.now();
    const result = await provider.completeText({
      model: config.LLM_PROVIDER === "anthropic" ? config.SUGGEST_MODEL : decision.model ?? config.DEEPSEEK_CHAT_MODEL,
      maxTokens: input.policy === "whisper_copilot" ? 120 : 500,
      temperature: 0.2,
      system: [
        "You are a consent-based situational copilot.",
        "Answer the user concisely and safely.",
        "Do not make final medical, legal, financial, investment, tax, or relationship decisions.",
        "Prefer questions, verification, and written documentation where relevant.",
        `Situation type: ${input.internalType}.`,
        `Safety boundaries: ${safetyBoundariesFor(input.internalType).join(" ")}`,
        humanContext?.occupation ? `User confirmed occupation/context: ${humanContext.occupation}.` : "",
        humanContext?.communicationPreferences ? `User communication preferences: ${JSON.stringify(humanContext.communicationPreferences)}.` : "",
        researchNeed.needsResearch ? "If fresh facts are required, say that research/citations are needed unless provided in context." : "",
        input.policy === "whisper_copilot" ? "The user is live in a real-world situation. Keep the response short and non-distracting." : "",
      ].filter(Boolean).join("\n"),
      messages: [{ role: "user", content: input.text }],
      metadata: { policy: input.policy, internalType: input.internalType },
    });
    await recordProviderUsage({
      userId: input.userId ?? null,
      sessionId: input.sessionId ?? null,
      provider: result.provider,
      model: result.model,
      operation: "voice_agent.complete_text",
      usage: result.usage,
      latencyMs: Date.now() - startedAt,
      status: "completed",
    }).catch(() => null);
    return { kind: "assistant_text", text: prepareAssistantTextForPolicy(adaptTextToUser(result.text, humanContext), input.policy) };
  } catch (err) {
    if (err instanceof LlmProviderError && err.code === "provider_not_configured") {
      return { kind: "provider_not_configured", message: err.message };
    }
    if (err instanceof GovernorBudgetExceededError) {
      return { kind: "provider_not_configured", message: "budget_exceeded" };
    }
    throw err;
  }
}

export function deterministicPreparation(internalType: InternalType, occupation?: string | null): string {
  const playbooks = getPlaybooks(internalType);
  const questions = unique(playbooks.flatMap((p) => p.prepQuestions)).slice(0, 6);
  const redFlags = unique(playbooks.flatMap((p) => p.redFlags)).slice(0, 4);
  const boundaries = safetyBoundariesFor(internalType).slice(0, 2);
  return [
    occupation ? `Given your confirmed background (${occupation}), keep the prep practical.` : "",
    `Prepare with these questions: ${questions.join("; ")}.`,
    redFlags.length > 0 ? `Watch for red flags: ${redFlags.join("; ")}.` : "",
    boundaries.length > 0 ? `Boundary: ${boundaries.join(" ")}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isDailyBriefRequest(text: string): boolean {
  return /\b(what do i need to do today|daily brief|today'?s priorities|what'?s on my plate|what should i do today)\b/i.test(text);
}

function isInvestorOutreachRequest(text: string): boolean {
  return /\b(find investors|draft investor emails|prepare outreach|investor outreach|who should i contact|fundraising outreach|find vcs|find venture capital|investor leads)\b/i.test(text);
}

function isInvestorListReviewRequest(text: string): boolean {
  return /\b(review my investor list|campaign quality|outreach quality|investor list review)\b/i.test(text);
}

function isStrongestInvestorRequest(text: string): boolean {
  return /\b(which investors are strongest|strongest investors|best investor leads|why this investor)\b/i.test(text);
}

async function latestOutreachCampaign(userId: string) {
  const [campaign] = await db.select().from(outreachCampaigns).where(eq(outreachCampaigns.userId, userId)).orderBy(desc(outreachCampaigns.updatedAt), desc(outreachCampaigns.createdAt)).limit(1);
  return campaign ?? null;
}

function inferOutreachSectors(text: string): string[] {
  const sectors = ["fintech", "ai", "health", "climate", "crypto", "blockchain", "payments", "developer tools", "consumer", "enterprise"].filter((term) =>
    text.toLowerCase().includes(term),
  );
  return sectors.length ? sectors : ["startup"];
}

function inferOutreachStage(text: string): string | null {
  const match = text.match(/\b(pre[- ]seed|seed|series a|series b|growth)\b/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function inferOutreachGeography(text: string): string | null {
  const match = text.match(/\b(africa|morocco|europe|france|us|united states|mena|middle east)\b/i);
  return match?.[1] ?? null;
}

function inferRaiseTarget(text: string): string | null {
  const match = text.match(/\$?\b(\d+(?:\.\d+)?\s?(?:k|m|million|thousand))\b/i);
  return match?.[0] ?? null;
}

function isOpenCommitmentsRequest(text: string): boolean {
  return /\b(what did i promise|open commitments|what do i owe|what did i agree to)\b/i.test(text);
}

function isWaitingOnRequest(text: string): boolean {
  return /\b(what am i waiting on|waiting on|waiting for others|who owes me|what are others doing)\b/i.test(text);
}

function isMakeDayEasierRequest(text: string): boolean {
  return /\b(make my day easier|easy plan|low[- ]effort|quick wins?)\b/i.test(text);
}

function isWeeklyReviewRequest(text: string): boolean {
  return /\b(weekly review|review my week|week recap)\b/i.test(text);
}

function isRememberTaskRequest(text: string): boolean {
  return /\b(remember|add|capture).{0,30}\b(i need to|i will|i'll|follow up|send|prepare)\b|\bi need to\b/i.test(text);
}

function isDraftFollowupActionRequest(text: string): boolean {
  return /\b(draft|write|compose).{0,40}\b(follow[- ]?up|email|message)\b/i.test(text);
}

function isScheduleMeetingRequest(text: string): boolean {
  return /\b(schedule|book|set up).{0,40}\b(meeting|appointment|call)\b/i.test(text);
}

function isSendRequest(text: string): boolean {
  return /\b(send it|send this|send the email|send the message)\b/i.test(text);
}

function isReminderActionRequest(text: string): boolean {
  return /\b(remind me|set a reminder)\b/i.test(text);
}

function isActionIntentRequest(text: string): boolean {
  return isDraftFollowupActionRequest(text) || isScheduleMeetingRequest(text) || isSendRequest(text) || isReminderActionRequest(text);
}

function cleanReminderTitle(text: string): string {
  return text.replace(/\b(remind me to|set a reminder to|remind me)\b/i, "").replace(/[.!?]+$/g, "").trim() || "Reminder";
}

function formatDailyBriefForVoice(draft: { summary: string; actionItems: Array<{ title: string; priority: string }> }): string {
  const top = draft.actionItems.slice(0, 4).map((item) => `${item.title} (${item.priority})`);
  return top.length ? `${draft.summary} Top items: ${top.join("; ")}.` : draft.summary;
}
