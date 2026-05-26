import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { researchAnswers, researchQueries, researchSources, situationBriefs } from "../db/schema.js";
import { proposeProfileFactsFromText, summarizeHumanContext } from "../human/profile.js";
import { createSearchProvider } from "../research/provider.js";
import { ResearchProviderError } from "../research/types.js";
import { detectResearchNeed } from "../research/need-detector.js";
import { classifySource, scoreSource } from "../research/verifier.js";
import { composeResearchAnswer } from "../research/composer.js";
import { getPlaybooks, safetyBoundariesFor } from "../situation/playbooks.js";
import { buildSituationBrief } from "../situation/brief.js";
import { generateStressSupport } from "../stress/support.js";
import { detectStressSignal } from "../stress/detector.js";
import { proposeSkillFromReflection } from "../skills/learner.js";
import { createProposedSkill } from "../skills/registry.js";
import { startResearchSubagent } from "../subagents/orchestrator.js";
import { logBrainAuditEvent } from "./audit.js";
import type { BrainQueryInput, BrainQueryResult } from "./types.js";

export async function answerBrainQuery(input: BrainQueryInput): Promise<BrainQueryResult> {
  await proposeProfileFactsFromText({ userId: input.userId, text: input.text, sessionId: input.sessionId ?? null }).catch(() => []);
  const profile = input.allowProfileContext === false ? null : await summarizeHumanContext(input.userId);
  const situation = input.situationBriefId ? await getSituation(input.userId, input.situationBriefId) : null;
  const internalType = situation?.inferredType ?? buildSituationBrief({ description: input.text }).inferredType;
  const stress = detectStressSignal(input.text);
  const researchNeed = detectResearchNeed({ text: input.text, internalType, situationDescription: situation?.description ?? undefined });

  let answer: string;
  let research: unknown;
  if (stress.detected) {
    const support = await generateStressSupport({ userId: input.userId, sessionId: input.sessionId ?? null, text: input.text, allowTransientWithoutOptIn: true });
    answer = support.content;
  } else if (researchNeed.needsResearch && input.allowResearch !== false) {
    if (input.researchMode === "subagent") {
      const task = await startResearchSubagent({
        userId: input.userId,
        sessionId: input.sessionId ?? null,
        situationBriefId: input.situationBriefId ?? null,
        query: researchNeed.suggestedQuery ?? input.text,
        internalType,
        trigger: "research_needed",
        liveDelivery: "main_agent_summary",
      });
      answer = "Research task started. I can continue while sources are checked in the background.";
      research = {
        status: "subagent_started",
        taskId: task.id,
        message: "Research task started. The main agent can continue and use the report when ready.",
      };
    } else {
    const queryRecord = await createResearchRecord(input, researchNeed.suggestedQuery ?? input.text, internalType, researchNeed.urgency !== "none");
    await logBrainAuditEvent({
      userId: input.userId,
      sessionId: input.sessionId ?? null,
      eventType: "research_request",
      payload: { queryId: queryRecord.id, researchKind: researchNeed.researchKind, provider: queryRecord.provider },
    }).catch(() => null);
    try {
      const provider = createSearchProvider();
      const results = await provider.search({ query: researchNeed.suggestedQuery ?? input.text, maxResults: 6 });
      const scored = results.map((result) => ({ ...result, sourceType: result.sourceType ?? classifySource(result.url), credibilityScore: scoreSource(result, internalType) }));
      await db.insert(researchSources).values(scored.map((source) => ({
        queryId: queryRecord.id,
        url: source.url,
        title: source.title,
        sourceType: source.sourceType ?? "unknown",
        snippet: source.snippet,
        publishedAt: source.publishedAt ? new Date(source.publishedAt) : null,
        credibilityScore: source.credibilityScore,
      })));
      const composed = await composeResearchAnswer({ query: input.text, sources: scored, internalType });
      await db.insert(researchAnswers).values({ queryId: queryRecord.id, answer: composed.answer, citations: composed.citations, confidence: composed.confidence, limitations: composed.limitations ?? null });
      await db.update(researchQueries).set({ status: "completed", completedAt: new Date() }).where(eq(researchQueries.id, queryRecord.id));
      answer = composed.answer;
      research = { queryId: queryRecord.id, sources: scored, answer: composed };
    } catch (err) {
      await db.update(researchQueries).set({ status: "failed", completedAt: new Date() }).where(eq(researchQueries.id, queryRecord.id));
      if (err instanceof ResearchProviderError || /configured/i.test((err as Error).message)) {
        answer = "Research provider is not configured. I did not generate sources or citations.";
        research = { queryId: queryRecord.id, error: "provider_not_configured" };
      } else {
        throw err;
      }
    }
    }
  } else {
    answer = deterministicBrainAnswer(internalType, profile);
  }

  const auditEventId = await logBrainAuditEvent({
    userId: input.userId,
    sessionId: input.sessionId ?? null,
    eventType: "brain_query",
    payload: { text: input.text, usedProfileContext: Boolean(profile), researchNeed, researchUsed: Boolean(research) },
  });
  const skillDraft = proposeSkillFromReflection({ text: input.text, internalType });
  if (skillDraft) await createProposedSkill(input.userId, skillDraft).catch(() => null);
  return {
    status: input.researchMode === "subagent" && researchNeed.needsResearch && input.allowResearch !== false ? "subagent_started" : "answered",
    answer,
    usedProfileContext: Boolean(profile),
    researchNeed,
    research,
    taskId: typeof research === "object" && research && "taskId" in research ? String((research as { taskId: unknown }).taskId) : undefined,
    message: typeof research === "object" && research && "message" in research ? String((research as { message: unknown }).message) : undefined,
    auditEventId: auditEventId ?? undefined,
  };
}

async function getSituation(userId: string, situationBriefId: string) {
  const [row] = await db.select().from(situationBriefs).where(eq(situationBriefs.id, situationBriefId)).limit(1);
  return row?.userId === userId ? row : null;
}

async function createResearchRecord(input: BrainQueryInput, query: string, intent: string, requiresFreshness: boolean) {
  const [row] = await db
    .insert(researchQueries)
    .values({
      userId: input.userId,
      sessionId: input.sessionId ?? null,
      situationBriefId: input.situationBriefId ?? null,
      query,
      normalizedQuery: query.toLowerCase().replace(/\s+/g, " ").trim(),
      intent,
      provider: input.allowResearch === false ? "none" : config.RESEARCH_PROVIDER,
      status: "pending",
      requiresFreshness,
    })
    .returning();
  if (!row) throw new Error("failed to create research query");
  return row;
}

function deterministicBrainAnswer(internalType: string, profile: Awaited<ReturnType<typeof summarizeHumanContext>> | null): string {
  const playbooks = getPlaybooks(internalType as never);
  const questions = [...new Set(playbooks.flatMap((p) => p.prepQuestions))].slice(0, 5);
  const boundaries = safetyBoundariesFor(internalType as never).slice(0, 1);
  const occupation = profile?.occupation ? `Given your background (${profile.occupation}), ` : "";
  const preference = profile?.communicationPreferences?.preference === "short" ? "Short version: " : "";
  return `${preference}${occupation}focus on these questions: ${questions.join("; ")}. ${boundaries.join(" ")}`.trim();
}
