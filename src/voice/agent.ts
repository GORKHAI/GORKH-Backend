import { config } from "../config.js";
import { db } from "../db/client.js";
import { commitments, taskItems, type InternalType } from "../db/schema.js";
import { and, desc, eq, inArray } from "drizzle-orm";
import { createActionProposal } from "../actions/proposal.js";
import { buildDailyBriefDraft } from "../daily/daily-brief.js";
import { extractCommitmentsFromText } from "../daily/commitment-extractor.js";
import { proposeTasksForCommitments } from "../daily/task-inbox.js";
import { generateWeeklyReview } from "../daily/weekly-review.js";
import { createLlmProvider } from "../llm/provider.js";
import { LlmProviderError, type LlmProvider } from "../llm/types.js";
import { recordProviderUsage } from "../governor/budget.js";
import { routeWork } from "../governor/router.js";
import { summarizeHumanContext } from "../human/profile.js";
import { adaptTextToUser } from "../personalization/adaptation.js";
import { detectResearchNeed } from "../research/need-detector.js";
import { getPlaybooks, safetyBoundariesFor } from "../situation/playbooks.js";
import { isStressSupportRequest } from "../stress/detector.js";
import { generateStressSupport } from "../stress/support.js";
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
