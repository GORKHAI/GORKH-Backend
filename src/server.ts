import websocket from "@fastify/websocket";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { signUserToken, verifyUserToken } from "./auth/jwt.js";
import { config, validateBootConfig } from "./config.js";
import { checkDb, db } from "./db/client.js";
import {
  actionApprovals,
  actionExecutionLogs,
  actionProposals,
  agentTurns,
  brainAuditEvents,
  brainReflections,
  commitments,
  cueEvents,
  evaluationEvents,
  followupSuggestions,
  humanProfileFacts,
  meetingPacks,
  providerUsageEvents,
  researchAnswers,
  researchQueries,
  researchSources,
  sessions,
  situationBriefs,
  skills,
  subagentReports,
  subagentTasks,
  suggestions,
  taskItems,
  transcriptSegments,
  users,
  voiceOutputs,
} from "./db/schema.js";
import { approveActionProposal, rejectActionProposal } from "./actions/approval.js";
import { executeActionProposal } from "./actions/executor.js";
import { createActionProposal, getOwnedActionProposal, listActionProposals } from "./actions/proposal.js";
import { actionDecisionBodySchema, createActionProposalSchema } from "./actions/types.js";
import { getConnectorManifest, listConnectorManifests } from "./connectors/registry.js";
import { connectorIdSchema } from "./connectors/types.js";
import { connectorPermissionSummary } from "./connectors/permissions.js";
import { extractCommitmentsFromText } from "./daily/commitment-extractor.js";
import { generateDailyBrief, getTodayBrief } from "./daily/daily-brief.js";
import { createPrepPack, createRecapPack, getOwnedMeetingPack } from "./daily/meeting-pack.js";
import { listTaskInbox, proposeTasksForCommitments, updateCommitmentStatus, updateTaskStatus } from "./daily/task-inbox.js";
import { answerBrainQuery } from "./brain/orchestrator.js";
import { logBrainAuditEvent } from "./brain/audit.js";
import { selectedLlmStatus } from "./llm/provider.js";
import { recordFeedback } from "./personalization/feedback.js";
import { checkRedis } from "./redis.js";
import { researchProviderStatus } from "./research/provider.js";
import { detectResearchNeed } from "./research/need-detector.js";
import { createSearchProvider } from "./research/provider.js";
import { ResearchProviderError } from "./research/types.js";
import { classifySource, scoreSource } from "./research/verifier.js";
import { composeResearchAnswer } from "./research/composer.js";
import { evaluateResearchAnswerQuality, persistEvaluation } from "./evaluation/research-quality.js";
import { evaluateCueQuality } from "./evaluation/cue-quality.js";
import { planResearchQuery } from "./research/query-planner.js";
import { classifyResearchDomain } from "./research/source-policy.js";
import { scoreResearchSources } from "./research/quality.js";
import { governorStatus, providerUsageSummary } from "./governor/policy.js";
import { createSituationBrief, getOwnedSituationBrief } from "./situation/brief.js";
import { approveSkill, disableSkill, enableSkill, listUserSkills, matchEnabledSkillsForSituation } from "./skills/registry.js";
import { generateStressSupport } from "./stress/support.js";
import { crisisResource } from "./stress/crisis.js";
import { listToolManifests } from "./tools/registry.js";
import { invokeTool } from "./tools/executor.js";
import { permissionModel } from "./tools/permissions.js";
import {
  cancelSubagentTask,
  getOwnedSubagentEvents,
  getOwnedSubagentReport,
  getOwnedSubagentTask,
  listSubagentTasks,
} from "./subagents/scheduler.js";
import { startSubagentTask } from "./subagents/orchestrator.js";
import { createSubagentTaskSchema } from "./subagents/types.js";
import { listSubagentNotifications } from "./subagents/notifications.js";
import { queueStatus, currentWorkerId } from "./subagents/queue.js";
import { recentSubagentFailures, subagentQueueMetrics } from "./subagents/metrics.js";
import { startSubagentWorkerLoop } from "./subagents/worker.js";
import {
  applyConfirmedProfileFact,
  getOrCreateHumanProfile,
  rejectProfileFactById,
  setStressSupportOptIn,
  summarizeHumanContext,
} from "./human/profile.js";
import { handleConnection } from "./ws/handler.js";
import { getOwnedTurns, getOwnedVoiceOutputs, getOwnedVoiceSession, handleVoiceConnection } from "./voice/ws.js";

const devUserBody = z.object({
  email: z.string().email(),
  displayName: z.string().nullable().optional(),
});

const situationBody = z.object({
  description: z.string().min(1),
  userGoal: z.string().nullable().optional(),
  participants: z.array(z.string()).nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

const brainQueryBody = z.object({
  text: z.string().min(1),
  situationBriefId: z.string().uuid().nullable().optional(),
  sessionId: z.string().uuid().nullable().optional(),
  allowResearch: z.boolean().optional(),
  allowProfileContext: z.boolean().optional(),
  researchMode: z.enum(["inline", "subagent"]).optional(),
});

const stressSupportBody = z.object({
  text: z.string().min(1),
  sessionId: z.string().uuid().nullable().optional(),
});

const skillMatchBody = z.object({
  situationDescription: z.string().min(1),
  internalType: z.string().min(1).nullable().optional(),
});

const feedbackBody = z.object({
  sessionId: z.string().uuid().nullable().optional(),
  targetType: z.enum(["cue", "assistant_text", "suggestion", "research_answer", "memory", "skill"]),
  targetId: z.string().nullable().optional(),
  rating: z.number().int().min(-1).max(1).nullable().optional(),
  feedback: z.string().nullable().optional(),
  outcome: z.string().nullable().optional(),
});

const manualCommitmentBody = z.object({
  text: z.string().min(1),
  sourceType: z.enum(["manual", "user_text"]).default("manual"),
});

const meetingPrepBody = z.object({
  situationBriefId: z.string().uuid().nullable().optional(),
  situationDescription: z.string().min(1),
  title: z.string().nullable().optional(),
});

const meetingRecapBody = z.object({
  sessionId: z.string().uuid(),
  title: z.string().nullable().optional(),
});

export async function buildServer() {
  validateBootConfig();
  const app = Fastify({ logger: true });
  await app.register(websocket);
  app.addHook("onRequest", async (request, reply) => {
    applyOpsCors(request, reply);
    if (request.method === "OPTIONS") return reply.code(204).send();
  });
  const stopSubagentWorker = config.SUBAGENT_RUNNER_MODE === "db_worker" ? startSubagentWorkerLoop() : () => undefined;
  app.addHook("onClose", async () => {
    stopSubagentWorker();
  });

  app.get("/health", async () => {
    const [dbReady, redisReady] = await Promise.all([checkDb(), checkRedis()]);
    return {
      ok: dbReady && redisReady,
      db: dbReady,
      redis: redisReady,
      providers: providerStatus(),
    };
  });

  app.get("/health/ready", async (_, reply) => {
    const [dbReady, redisReady] = await Promise.all([checkDb(), checkRedis()]);
    if (!dbReady || !redisReady) {
      return reply.code(503).send({ ok: false, db: dbReady, redis: redisReady, providers: providerStatus() });
    }
    return reply.send({ ok: true, db: true, redis: true, providers: providerStatus() });
  });

  function providerStatus() {
    return {
      llm: selectedLlmStatus(),
      deepseek: Boolean(config.DEEPSEEK_API_KEY),
      anthropic: Boolean(config.ANTHROPIC_API_KEY),
      deepgram: Boolean(config.DEEPGRAM_API_KEY),
      voyage: Boolean(config.VOYAGE_API_KEY),
      research: researchProviderStatus(),
    };
  }

  if (config.NODE_ENV !== "production") {
    app.post("/dev/users", async (request, reply) => {
      const body = devUserBody.parse(request.body);
      const [user] = await db
        .insert(users)
        .values({ email: body.email, displayName: body.displayName ?? null })
        .onConflictDoUpdate({
          target: users.email,
          set: { displayName: body.displayName ?? null },
        })
        .returning();
      if (!user) throw new Error("failed to create user");
      return reply.send({ user, token: await signUserToken(user.id) });
    });
  }

  app.post("/ops/test-user", async (request, reply) => {
    if (!config.OPS_CONSOLE_ENABLED || !config.OPS_CONSOLE_ALLOW_TEST_USER || !config.OPS_CONSOLE_ADMIN_TOKEN) {
      return reply.code(404).send({ error: "not found" });
    }
    if (!isOpsAdminRequest(request)) return reply.code(401).send({ error: "missing or invalid ops token" });
    const body = devUserBody.parse(request.body);
    const [user] = await db
      .insert(users)
      .values({ email: body.email, displayName: body.displayName ?? null })
      .onConflictDoUpdate({
        target: users.email,
        set: { displayName: body.displayName ?? null },
      })
      .returning();
    if (!user) throw new Error("failed to create ops test user");
    const ttl = `${config.OPS_CONSOLE_SESSION_TTL_SECONDS}s`;
    return reply.send({ user, token: await signUserToken(user.id, ttl), expiresInSeconds: config.OPS_CONSOLE_SESSION_TTL_SECONDS });
  });

  app.post("/situations", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const body = situationBody.parse(request.body);
    const result = await createSituationBrief(userId, body);
    return reply.send({ situationBrief: result.brief, prepQuestions: result.prepQuestions });
  });

  app.get("/situations/:id", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const brief = await getOwnedSituationBrief(userId, params.id);
    if (!brief) return reply.code(404).send({ error: "not found" });
    return reply.send({ situationBrief: brief });
  });

  app.get("/sessions/:id", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const [session] = await db.select().from(sessions).where(and(eq(sessions.id, params.id), eq(sessions.userId, userId))).limit(1);
    if (!session) return reply.code(404).send({ error: "not found" });
    const [transcriptCount, suggestionCount, cueCount, agentTurnCount, voiceOutputCount] = await Promise.all([
      countTranscriptSegments(params.id),
      countSuggestions(params.id),
      countCueEvents(params.id),
      countAgentTurns(params.id),
      countVoiceOutputs(params.id),
    ]);
    return reply.send({
      id: session.id,
      userId: session.userId,
      situationBriefId: session.situationBriefId,
      internalType: session.internalType,
      status: session.status,
      title: session.title,
      consentGranted: session.consentGranted,
      retentionPolicy: session.retentionPolicy,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      counts: {
        transcriptSegments: transcriptCount,
        suggestions: suggestionCount,
        cueEvents: cueCount,
        agentTurns: agentTurnCount,
        voiceOutputs: voiceOutputCount,
      },
    });
  });

  app.get("/sessions/:id/transcript", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    if (!(await ownedSession(userId, params.id))) return reply.code(404).send({ error: "not found" });
    const rows = await db
      .select()
      .from(transcriptSegments)
      .where(eq(transcriptSegments.sessionId, params.id))
      .orderBy(asc(transcriptSegments.offsetMs), asc(transcriptSegments.createdAt));
    return reply.send({ transcriptSegments: rows });
  });

  app.get("/sessions/:id/cues", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    if (!(await ownedSession(userId, params.id))) return reply.code(404).send({ error: "not found" });
    const rows = await db.select().from(cueEvents).where(eq(cueEvents.sessionId, params.id)).orderBy(asc(cueEvents.createdAt));
    return reply.send({ cueEvents: rows });
  });

  app.get("/sessions/:id/suggestions", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    if (!(await ownedSession(userId, params.id))) return reply.code(404).send({ error: "not found" });
    const rows = await db.select().from(suggestions).where(eq(suggestions.sessionId, params.id)).orderBy(asc(suggestions.createdAt));
    return reply.send({ suggestions: rows });
  });

  app.get("/sessions/:id/turns", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const rows = await getOwnedTurns(userId, params.id);
    if (!rows) return reply.code(404).send({ error: "not found" });
    return reply.send({ agentTurns: rows });
  });

  app.get("/sessions/:id/voice-outputs", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const rows = await getOwnedVoiceOutputs(userId, params.id);
    if (!rows) return reply.code(404).send({ error: "not found" });
    return reply.send({ voiceOutputs: rows });
  });

  app.get("/sessions/:id/voice-session", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const row = await getOwnedVoiceSession(userId, params.id);
    if (!row) return reply.code(404).send({ error: "not found" });
    return reply.send({ voiceSession: row });
  });

  app.get("/human/profile", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const profile = await getOrCreateHumanProfile(userId);
    const summary = await summarizeHumanContext(userId, { includeProposed: true });
    return reply.send({ profile, summary });
  });

  app.post("/human/profile/facts/:id/confirm", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const fact = await applyConfirmedProfileFact(userId, params.id);
    if (!fact) return reply.code(404).send({ error: "not found" });
    return reply.send({ fact });
  });

  app.post("/human/profile/facts/:id/reject", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const fact = await rejectProfileFactById(userId, params.id);
    if (!fact) return reply.code(404).send({ error: "not found" });
    return reply.send({ fact });
  });

  app.get("/human/context-summary", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    return reply.send({ summary: await summarizeHumanContext(userId) });
  });

  app.get("/human/profile/review", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const [profile, facts, profileSummary] = await Promise.all([
      getOrCreateHumanProfile(userId),
      db.select().from(humanProfileFacts).where(eq(humanProfileFacts.userId, userId)).orderBy(desc(humanProfileFacts.createdAt)),
      summarizeHumanContext(userId),
    ]);
    return reply.send({
      profile,
      confirmedFacts: facts.filter((fact) => fact.status === "confirmed"),
      proposedFacts: facts.filter((fact) => fact.status === "proposed" && fact.sensitivity !== "sensitive"),
      sensitiveCandidates: facts.filter((fact) => fact.kind === "sensitive_candidate" || fact.sensitivity === "sensitive"),
      rejectedFacts: facts.filter((fact) => fact.status === "rejected"),
      profileSummary,
      pendingActions: {
        proposedFacts: facts.filter((fact) => fact.status === "proposed" && fact.sensitivity !== "sensitive").length,
        sensitiveCandidates: facts.filter((fact) => fact.status === "proposed" && fact.sensitivity === "sensitive").length,
      },
    });
  });

  app.post("/stress/opt-in", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    return reply.send({ profile: await setStressSupportOptIn(userId, true) });
  });

  app.post("/stress/opt-out", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    return reply.send({ profile: await setStressSupportOptIn(userId, false) });
  });

  app.post("/stress/support", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const body = stressSupportBody.parse(request.body);
    if (body.sessionId && !(await ownedSession(userId, body.sessionId))) return reply.code(404).send({ error: "not found" });
    return reply.send({ support: await generateStressSupport({ userId, text: body.text, sessionId: body.sessionId ?? null, allowTransientWithoutOptIn: true }) });
  });

  app.get("/stress/settings", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const profile = await getOrCreateHumanProfile(userId);
    return reply.send({
      optedIn: profile.stressSupportOptIn,
      locale: config.STRESS_SUPPORT_DEFAULT_LOCALE,
      crisisResources: {
        default: crisisResource(config.STRESS_SUPPORT_DEFAULT_LOCALE),
        france: { name: config.STRESS_SUPPORT_FR_RESOURCE_NAME, description: config.STRESS_SUPPORT_FR_RESOURCE_DESCRIPTION },
        us: { name: config.STRESS_SUPPORT_US_RESOURCE_NAME, description: config.STRESS_SUPPORT_US_RESOURCE_DESCRIPTION },
      },
      storagePolicy: {
        requiresOptIn: config.STRESS_SUPPORT_REQUIRE_OPT_IN,
        transientSupportWithoutStorage: true,
        sensitiveFactsRequireConfirmation: true,
      },
    });
  });

  app.post("/brain/query", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const body = brainQueryBody.parse(request.body);
    if (body.sessionId && !(await ownedSession(userId, body.sessionId))) return reply.code(404).send({ error: "not found" });
    if (body.situationBriefId && !(await getOwnedSituationBrief(userId, body.situationBriefId))) return reply.code(404).send({ error: "not found" });
    return reply.send(await answerBrainQuery({ userId, ...body }));
  });

  app.get("/brain/reflections", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const rows = await db.select().from(brainReflections).where(eq(brainReflections.userId, userId)).orderBy(desc(brainReflections.createdAt)).limit(50);
    return reply.send({ reflections: rows });
  });

  app.get("/brain/audit-events", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const rows = await db.select().from(brainAuditEvents).where(eq(brainAuditEvents.userId, userId)).orderBy(desc(brainAuditEvents.createdAt)).limit(100);
    return reply.send({ auditEvents: rows });
  });

  app.get("/brain/dashboard", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const profile = await getOrCreateHumanProfile(userId);
    const [
      profileSummary,
      pendingFacts,
      pendingSkills,
      recentReflections,
      enabledSkills,
      pendingSubagents,
      runningSubagents,
      recentSubagentReports,
      proposedTasks,
      openCommitments,
      proposedFollowups,
      meetingPackCount,
      proposedActions,
      recentEvaluationWarnings,
      usageSummary,
    ] = await Promise.all([
      summarizeHumanContext(userId),
      countProfileFacts(userId, "proposed"),
      countSkills(userId, "proposed"),
      countRecentReflections(userId),
      countSkills(userId, "enabled"),
      countSubagentTasks(userId, "queued"),
      countSubagentTasks(userId, "running"),
      countRecentSubagentReports(userId),
      countTaskItems(userId, "proposed"),
      countCommitments(userId, "proposed"),
      countFollowups(userId, "proposed"),
      countMeetingPacks(userId),
      countActionProposals(userId, "proposed"),
      countRecentEvaluationWarnings(userId),
      providerUsageSummary(userId),
    ]);
    return reply.send({
      profileSummary,
      pendingProfileFactsCount: pendingFacts,
      pendingSkillsCount: pendingSkills,
      recentReflectionsCount: recentReflections,
      stressOptIn: profile.stressSupportOptIn,
      researchProviderStatus: researchProviderStatus(),
      enabledSkillsCount: enabledSkills,
      pendingSubagentTasksCount: pendingSubagents,
      runningSubagentTasksCount: runningSubagents,
      recentSubagentReportsCount: recentSubagentReports,
      dailyLife: {
        proposedTasksCount: proposedTasks,
        proposedCommitmentsCount: openCommitments,
        proposedFollowupsCount: proposedFollowups,
        meetingPacksCount: meetingPackCount,
      },
      actionApprovals: {
        proposedActionsCount: proposedActions,
      },
      researchQualitySummary: await evaluationSummaryForUser(userId, "research_answer"),
      cueLatencySummary: await evaluationSummaryForUser(userId, "cue"),
      providerUsageSummary: usageSummary,
      governorStatus: governorStatus(),
      recentEvaluationWarnings,
      safetySummary: {
        stressSupportIsNotTherapy: true,
        noHiddenRecording: true,
        dangerousToolCapabilitiesDisabled: permissionModel().dangerousCapabilitiesDisabled,
        sensitiveProfileFactsRequireConfirmation: true,
      },
    });
  });

  app.get("/actions/proposals", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    return reply.send({ proposals: await listActionProposals(userId) });
  });

  app.post("/actions/proposals", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const body = createActionProposalSchema.parse(request.body);
    if (body.sessionId && !(await ownedSession(userId, body.sessionId))) return reply.code(404).send({ error: "not found" });
    return reply.send({ proposal: await createActionProposal(userId, body) });
  });

  app.get("/actions/proposals/:id", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const proposal = await getOwnedActionProposal(userId, params.id);
    if (!proposal) return reply.code(404).send({ error: "not found" });
    const [approvals, executions] = await Promise.all([
      db.select().from(actionApprovals).where(eq(actionApprovals.proposalId, params.id)).orderBy(desc(actionApprovals.createdAt)),
      db.select().from(actionExecutionLogs).where(eq(actionExecutionLogs.proposalId, params.id)).orderBy(desc(actionExecutionLogs.createdAt)),
    ]);
    return reply.send({ proposal, approvals, executions });
  });

  app.post("/actions/proposals/:id/approve", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = actionDecisionBodySchema.parse(request.body ?? {});
    const result = await approveActionProposal(userId, params.id, body.reason ?? null);
    if (!result) return reply.code(404).send({ error: "not found" });
    return reply.send(result);
  });

  app.post("/actions/proposals/:id/reject", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = actionDecisionBodySchema.parse(request.body ?? {});
    const result = await rejectActionProposal(userId, params.id, body.reason ?? null);
    if (!result) return reply.code(404).send({ error: "not found" });
    return reply.send(result);
  });

  app.post("/actions/proposals/:id/execute", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    try {
      return reply.send(await executeActionProposal(userId, params.id));
    } catch (err) {
      if ((err as Error).message.includes("not found")) return reply.code(404).send({ error: "not found" });
      return reply.code(409).send({ error: (err as Error).message });
    }
  });

  app.get("/connectors", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    return reply.send({ connectors: listConnectorManifests() });
  });

  app.get("/connectors/:id", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: connectorIdSchema }).parse(request.params);
    const connector = getConnectorManifest(params.id);
    if (!connector) return reply.code(404).send({ error: "not found" });
    return reply.send({ connector });
  });

  app.get("/connectors/:id/permissions", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: connectorIdSchema }).parse(request.params);
    const connector = getConnectorManifest(params.id);
    if (!connector) return reply.code(404).send({ error: "not found" });
    return reply.send({ permissions: connectorPermissionSummary(connector) });
  });

  app.post("/subagents/tasks", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const body = createSubagentTaskSchema.parse(request.body);
    if (body.sessionId && !(await ownedSession(userId, body.sessionId))) return reply.code(404).send({ error: "not found" });
    if (body.situationBriefId && !(await getOwnedSituationBrief(userId, body.situationBriefId))) return reply.code(404).send({ error: "not found" });
    const task = await startSubagentTask({ userId, input: body });
    return reply.send({ task });
  });

  app.get("/subagents/tasks", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    return reply.send({ tasks: await listSubagentTasks(userId) });
  });

  app.get("/subagents/tasks/:id", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const task = await getOwnedSubagentTask(userId, params.id);
    if (!task) return reply.code(404).send({ error: "not found" });
    return reply.send({ task });
  });

  app.get("/subagents/tasks/:id/report", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const report = await getOwnedSubagentReport(userId, params.id);
    if (!report) return reply.code(404).send({ error: "not found" });
    return reply.send({ report });
  });

  app.post("/subagents/tasks/:id/cancel", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const canceled = await cancelSubagentTask(userId, params.id);
    if (!canceled) return reply.code(404).send({ error: "not found" });
    return reply.send({ canceled: true });
  });

  app.get("/subagents/events/:taskId", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ taskId: z.string().uuid() }).parse(request.params);
    const events = await getOwnedSubagentEvents(userId, params.taskId);
    if (!events) return reply.code(404).send({ error: "not found" });
    return reply.send({ events });
  });

  app.get("/subagents/notifications", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const query = z
      .object({
        since: z.string().datetime().optional(),
        taskId: z.string().uuid().optional(),
        limit: z.coerce.number().int().positive().max(500).optional(),
      })
      .parse(request.query);
    const notifications = await listSubagentNotifications({
      userId,
      since: query.since ? new Date(query.since) : undefined,
      taskId: query.taskId,
      limit: query.limit,
    });
    if (!notifications) return reply.code(404).send({ error: "not found" });
    return reply.send({ notifications });
  });

  app.get("/subagents/queue/status", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    return reply.send(await queueStatus(userId));
  });

  app.get("/subagents/queue/metrics", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const metrics = await subagentQueueMetrics(currentWorkerId());
    return reply.send(metrics);
  });

  app.get("/subagents/queue/failures", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const query = z.object({ limit: z.coerce.number().int().positive().max(100).optional() }).parse(request.query);
    return reply.send({ failures: await recentSubagentFailures(query.limit ?? 25) });
  });

  app.get("/subagents/stream", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const query = z.object({ taskId: z.string().uuid().optional() }).parse(request.query);
    if (query.taskId && !(await getOwnedSubagentTask(userId, query.taskId))) return reply.code(404).send({ error: "not found" });
    return streamSubagentNotifications(request, reply, { userId, taskId: query.taskId });
  });

  app.get("/sessions/:id/subagents/stream", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    if (!(await ownedSession(userId, params.id))) return reply.code(404).send({ error: "not found" });
    return streamSubagentNotifications(request, reply, { userId, sessionId: params.id });
  });

  app.post("/research/query", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const body = brainQueryBody.pick({ text: true, situationBriefId: true, sessionId: true }).parse(request.body);
    if (body.sessionId && !(await ownedSession(userId, body.sessionId))) return reply.code(404).send({ error: "not found" });
    const plan = planResearchQuery({ text: body.text, maxResults: config.RESEARCH_MAX_RESULTS });
    const decision = detectResearchNeed({ text: body.text });
    const [query] = await db
      .insert(researchQueries)
      .values({
        userId,
        sessionId: body.sessionId ?? null,
        situationBriefId: body.situationBriefId ?? null,
        query: body.text,
        normalizedQuery: plan.normalizedQuery.toLowerCase(),
        intent: decision.researchKind,
        provider: config.RESEARCH_PROVIDER,
        status: "pending",
        requiresFreshness: plan.requiresFreshness,
      })
      .returning();
    if (!query) throw new Error("failed to create research query");
    await logBrainAuditEvent({
      userId,
      sessionId: body.sessionId ?? null,
      eventType: "research_request",
      payload: { queryId: query.id, researchKind: decision.researchKind, provider: config.RESEARCH_PROVIDER },
    }).catch(() => null);
    try {
      const provider = createSearchProvider();
      const sources = (await provider.search({ query: plan.normalizedQuery, maxResults: plan.maxResults })).map((source) => ({
        ...source,
        sourceType: source.sourceType ?? classifySource(source.url),
        credibilityScore: scoreSource(source, plan.domain),
      }));
      if (sources.length > 0) {
        await db.insert(researchSources).values(
          sources.map((source) => ({
            queryId: query.id,
            url: source.url,
            title: source.title,
            sourceType: source.sourceType ?? "unknown",
            publishedAt: source.publishedAt ? new Date(source.publishedAt) : null,
            snippet: source.snippet,
            credibilityScore: source.credibilityScore,
          })),
        );
      }
      const answer = sources.length > 0 ? await composeResearchAnswer({ query: body.text, sources }) : null;
      if (answer) {
        const [answerRow] = await db.insert(researchAnswers).values({
          queryId: query.id,
          answer: answer.answer,
          citations: answer.citations,
          confidence: answer.confidence,
          limitations: answer.limitations ?? null,
        }).returning({ id: researchAnswers.id });
        if (config.RESEARCH_EVALUATION_ENABLED) {
          const evaluation = evaluateResearchAnswerQuality({
            query: body.text,
            answer,
            sources,
            domain: plan.domain,
            targetId: answerRow?.id ?? null,
          });
          await persistEvaluation({ userId, sessionId: body.sessionId ?? null, result: evaluation }).catch(() => null);
        }
      }
      await db.update(researchQueries).set({ status: "completed", completedAt: new Date() }).where(eq(researchQueries.id, query.id));
      return reply.send({ query: { ...query, status: "completed" }, plan, sourceQuality: scoreResearchSources(sources, plan.domain), sources, answer });
    } catch (err) {
      await db.update(researchQueries).set({ status: "skipped", completedAt: new Date() }).where(eq(researchQueries.id, query.id));
      if (err instanceof ResearchProviderError || /configured/i.test((err as Error).message)) {
        return reply.send({ query: { ...query, status: "skipped" }, error: { code: "provider_not_configured", message: "Research provider is not configured" }, sources: [] });
      }
      throw err;
    }
  });

  app.get("/research/providers", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    return reply.send({
      selected: config.RESEARCH_PROVIDER,
      configured: researchProviderStatus().configured,
      availableProviders: {
        brave: Boolean(config.BRAVE_API_KEY),
        tavily: Boolean(config.TAVILY_API_KEY),
        exa: Boolean(config.EXA_API_KEY),
      },
      browserProvider: config.BROWSER_PROVIDER,
      browserRestrictions: {
        provider: "none",
        httpMethods: ["GET"],
        cookies: false,
        authHeaders: false,
        login: false,
        forms: false,
        privateNetworkBlocked: true,
        maxBytes: config.RESEARCH_MAX_FETCH_BYTES,
      },
    });
  });

  app.get("/research/query/:id", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const [query] = await db.select().from(researchQueries).where(and(eq(researchQueries.id, params.id), eq(researchQueries.userId, userId))).limit(1);
    if (!query) return reply.code(404).send({ error: "not found" });
    const [sources, answers] = await Promise.all([
      db.select().from(researchSources).where(eq(researchSources.queryId, query.id)).orderBy(asc(researchSources.createdAt)),
      db.select().from(researchAnswers).where(eq(researchAnswers.queryId, query.id)).orderBy(asc(researchAnswers.createdAt)),
    ]);
    return reply.send({ query, sources, answers });
  });

  app.post("/research/query/evaluate", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const body = z.object({ queryId: z.string().uuid() }).parse(request.body);
    const [query] = await db.select().from(researchQueries).where(and(eq(researchQueries.id, body.queryId), eq(researchQueries.userId, userId))).limit(1);
    if (!query) return reply.code(404).send({ error: "not found" });
    const [sources, answers] = await Promise.all([
      db.select().from(researchSources).where(eq(researchSources.queryId, query.id)).orderBy(asc(researchSources.createdAt)),
      db.select().from(researchAnswers).where(eq(researchAnswers.queryId, query.id)).orderBy(desc(researchAnswers.createdAt)).limit(1),
    ]);
    const answerRow = answers[0];
    if (!answerRow) return reply.code(404).send({ error: "answer not found" });
    const answer = {
      answer: answerRow.answer,
      citations: answerRow.citations as Array<{ url: string; title?: string; quote?: string }>,
      confidence: answerRow.confidence,
      limitations: answerRow.limitations,
    };
    const searchResults = sources.map((source) => ({
      title: source.title ?? source.url,
      url: source.url,
      snippet: source.snippet ?? source.extractedText ?? "",
      publishedAt: source.publishedAt?.toISOString() ?? null,
      sourceType: source.sourceType,
    }));
    const result = evaluateResearchAnswerQuality({
      query: query.query,
      answer,
      sources: searchResults,
      domain: classifyResearchDomain({ text: query.query, intent: query.intent }),
      targetId: answerRow.id,
    });
    await persistEvaluation({ userId, sessionId: query.sessionId, result });
    return reply.send({ evaluation: result });
  });

  app.get("/evaluation/events", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const rows = await db.select().from(evaluationEvents).where(eq(evaluationEvents.userId, userId)).orderBy(desc(evaluationEvents.createdAt)).limit(100);
    return reply.send({ evaluationEvents: rows });
  });

  app.get("/evaluation/summary", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    return reply.send({
      researchQualitySummary: await evaluationSummaryForUser(userId, "research_answer"),
      cueLatencySummary: await evaluationSummaryForUser(userId, "cue"),
      recentEvaluationWarnings: await countRecentEvaluationWarnings(userId),
    });
  });

  app.post("/evaluation/recompute/:targetType/:targetId", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ targetType: z.enum(["research_answer", "cue", "assistant_text", "subagent_report", "action_proposal", "daily_brief"]), targetId: z.string().min(1) }).parse(request.params);
    if (params.targetType === "cue") {
      const body = z
        .object({
          cueText: z.string().trim().min(1).optional(),
          transcriptReceivedAt: z.number().int().nonnegative().optional(),
          cueEmittedAt: z.number().int().nonnegative().optional(),
          delivery: z.string().optional(),
        })
        .parse(request.body ?? {});
      if (!body.cueText) return reply.code(409).send({ error: "cue_text_required_for_recompute" });
      const result = evaluateCueQuality({
        cueText: body.cueText,
        targetId: params.targetId,
        transcriptReceivedAt: body.transcriptReceivedAt,
        cueEmittedAt: body.cueEmittedAt,
        delivery: body.delivery,
      });
      await persistEvaluation({ userId, result });
      return reply.send({ evaluation: result });
    }
    return reply.code(409).send({ error: "recompute_not_available_for_target" });
  });

  app.get("/governor/status", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    return reply.send({ governor: governorStatus() });
  });

  app.get("/governor/usage", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const rows = await db.select().from(providerUsageEvents).where(eq(providerUsageEvents.userId, userId)).orderBy(desc(providerUsageEvents.createdAt)).limit(100);
    return reply.send({ summary: await providerUsageSummary(userId), usageEvents: rows });
  });

  app.get("/tools", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    return reply.send({ tools: listToolManifests() });
  });

  app.get("/tools/permissions", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    return reply.send({ permissions: permissionModel() });
  });

  app.post("/tools/:name/invoke", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ name: z.string().min(1) }).parse(request.params);
    const body = z.object({ sessionId: z.string().uuid().nullable().optional(), input: z.unknown().optional() }).parse(request.body ?? {});
    if (body.sessionId && !(await ownedSession(userId, body.sessionId))) return reply.code(404).send({ error: "not found" });
    return reply.send({ invocation: await invokeTool({ userId, sessionId: body.sessionId ?? null, name: params.name, input: body.input ?? {} }) });
  });

  app.get("/skills", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    return reply.send({ skills: await listUserSkills(userId) });
  });

  app.post("/skills/match", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const body = skillMatchBody.parse(request.body);
    const query = `${body.internalType ?? ""} ${body.situationDescription}`;
    return reply.send({ skills: await matchEnabledSkillsForSituation(userId, query) });
  });

  app.post("/skills/:id/approve", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const skill = await approveSkill(userId, params.id);
    if (!skill) return reply.code(404).send({ error: "not found" });
    return reply.send({ skill });
  });

  app.post("/skills/:id/enable", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const skill = await enableSkill(userId, params.id);
    if (!skill) return reply.code(404).send({ error: "not found" });
    return reply.send({ skill });
  });

  app.post("/skills/:id/disable", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const skill = await disableSkill(userId, params.id);
    if (!skill) return reply.code(404).send({ error: "not found" });
    return reply.send({ skill });
  });

  app.post("/daily/commitments/propose", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const body = manualCommitmentBody.parse(request.body);
    const proposals = extractCommitmentsFromText({ text: body.text, sourceType: body.sourceType });
    if (proposals.length === 0) return reply.send({ commitments: [], tasks: [] });
    const inserted = await db
      .insert(commitments)
      .values(
        proposals.map((item) => ({
          userId,
          sessionId: null,
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
    const tasks = await proposeTasksForCommitments(inserted);
    return reply.send({ commitments: inserted, tasks });
  });

  app.get("/daily/commitments", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const rows = await db.select().from(commitments).where(eq(commitments.userId, userId)).orderBy(desc(commitments.createdAt)).limit(100);
    return reply.send({ commitments: rows });
  });

  app.post("/daily/commitments/:id/confirm", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const commitment = await updateCommitmentStatus(userId, params.id, "confirmed");
    if (!commitment) return reply.code(404).send({ error: "not found" });
    return reply.send({ commitment });
  });

  app.post("/daily/commitments/:id/dismiss", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const commitment = await updateCommitmentStatus(userId, params.id, "dismissed");
    if (!commitment) return reply.code(404).send({ error: "not found" });
    return reply.send({ commitment });
  });

  app.post("/daily/brief/generate", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    return reply.send({ dailyBrief: await generateDailyBrief(userId) });
  });

  app.get("/daily/brief/today", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    return reply.send({ dailyBrief: await getTodayBrief(userId) });
  });

  app.get("/daily/tasks", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    return reply.send({ tasks: await listTaskInbox(userId) });
  });

  app.post("/daily/tasks/:id/accept", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const task = await updateTaskStatus(userId, params.id, "accepted");
    if (!task) return reply.code(404).send({ error: "not found" });
    return reply.send({ task });
  });

  app.post("/daily/tasks/:id/dismiss", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const task = await updateTaskStatus(userId, params.id, "dismissed");
    if (!task) return reply.code(404).send({ error: "not found" });
    return reply.send({ task });
  });

  app.post("/daily/tasks/:id/done", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const task = await updateTaskStatus(userId, params.id, "done");
    if (!task) return reply.code(404).send({ error: "not found" });
    return reply.send({ task });
  });

  app.get("/daily/followups", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const rows = await db.select().from(followupSuggestions).where(eq(followupSuggestions.userId, userId)).orderBy(desc(followupSuggestions.createdAt)).limit(100);
    return reply.send({ followups: rows });
  });

  app.post("/meetings/prep-pack", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const body = meetingPrepBody.parse(request.body);
    if (body.situationBriefId && !(await getOwnedSituationBrief(userId, body.situationBriefId))) return reply.code(404).send({ error: "not found" });
    return reply.send({ meetingPack: await createPrepPack({ userId, ...body }) });
  });

  app.post("/meetings/recap-pack", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const body = meetingRecapBody.parse(request.body);
    if (!(await ownedSession(userId, body.sessionId))) return reply.code(404).send({ error: "not found" });
    const pack = await createRecapPack({ userId, sessionId: body.sessionId, title: body.title ?? null });
    if (!pack) return reply.code(409).send({ error: "recap requires a saved session" });
    return reply.send({ meetingPack: pack });
  });

  app.get("/meetings/packs/:id", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const pack = await getOwnedMeetingPack(userId, params.id);
    if (!pack) return reply.code(404).send({ error: "not found" });
    return reply.send({ meetingPack: pack });
  });

  app.get("/meetings/packs", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const rows = await db.select().from(meetingPacks).where(eq(meetingPacks.userId, userId)).orderBy(desc(meetingPacks.createdAt)).limit(100);
    return reply.send({ meetingPacks: rows });
  });

  app.post("/feedback", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const body = feedbackBody.parse(request.body);
    if (body.sessionId && !(await ownedSession(userId, body.sessionId))) return reply.code(404).send({ error: "not found" });
    return reply.send({ feedback: await recordFeedback({ userId, ...body }) });
  });

  app.get("/session", { websocket: true }, async (socket, request) => {
    try {
      const token = tokenFromRequest(request);
      if (!token) {
        socket.send(JSON.stringify({ type: "error", stage: "auth", message: "missing bearer token" }));
        socket.close();
        return;
      }
      const { userId } = await verifyUserToken(token);
      handleConnection(socket, userId);
    } catch (err) {
      socket.send(JSON.stringify({ type: "error", stage: "auth", message: String((err as Error).message) }));
      socket.close();
    }
  });

  app.get("/voice", { websocket: true }, async (socket, request) => {
    try {
      const token = tokenFromRequest(request);
      if (!token) {
        socket.send(JSON.stringify({ type: "error", stage: "auth", message: "missing bearer token" }));
        socket.close();
        return;
      }
      const { userId } = await verifyUserToken(token);
      handleVoiceConnection(socket, userId);
    } catch (err) {
      socket.send(JSON.stringify({ type: "error", stage: "auth", message: String((err as Error).message) }));
      socket.close();
    }
  });

  return app;
}

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
  const token = tokenFromRequest(request);
  if (!token) {
    reply.code(401).send({ error: "missing bearer token" });
    return null;
  }
  try {
    const { userId } = await verifyUserToken(token);
    return userId;
  } catch {
    reply.code(401).send({ error: "invalid bearer token" });
    return null;
  }
}

function tokenFromRequest(request: FastifyRequest): string | null {
  const auth = request.headers.authorization;
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const query = request.query as { token?: string } | undefined;
  return query?.token ?? null;
}

async function ownedSession(userId: string, sessionId: string): Promise<boolean> {
  const [row] = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId))).limit(1);
  return Boolean(row);
}

async function countTranscriptSegments(sessionId: string): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(transcriptSegments).where(eq(transcriptSegments.sessionId, sessionId));
  return Number(row?.count ?? 0);
}

async function countSuggestions(sessionId: string): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(suggestions).where(eq(suggestions.sessionId, sessionId));
  return Number(row?.count ?? 0);
}

async function countCueEvents(sessionId: string): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(cueEvents).where(eq(cueEvents.sessionId, sessionId));
  return Number(row?.count ?? 0);
}

async function countAgentTurns(sessionId: string): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(agentTurns).where(eq(agentTurns.sessionId, sessionId));
  return Number(row?.count ?? 0);
}

async function countVoiceOutputs(sessionId: string): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(voiceOutputs).where(eq(voiceOutputs.sessionId, sessionId));
  return Number(row?.count ?? 0);
}

async function countProfileFacts(userId: string, status: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(humanProfileFacts)
    .where(and(eq(humanProfileFacts.userId, userId), eq(humanProfileFacts.status, status as never)));
  return Number(row?.count ?? 0);
}

async function countSkills(userId: string, status: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(skills)
    .where(and(eq(skills.userId, userId), eq(skills.status, status as never)));
  return Number(row?.count ?? 0);
}

async function countRecentReflections(userId: string): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(brainReflections).where(eq(brainReflections.userId, userId));
  return Number(row?.count ?? 0);
}

async function countSubagentTasks(userId: string, status: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subagentTasks)
    .where(and(eq(subagentTasks.userId, userId), eq(subagentTasks.status, status as never)));
  return Number(row?.count ?? 0);
}

async function countRecentSubagentReports(userId: string): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(subagentReports).where(eq(subagentReports.userId, userId));
  return Number(row?.count ?? 0);
}

async function countTaskItems(userId: string, status: string): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(taskItems).where(and(eq(taskItems.userId, userId), eq(taskItems.status, status as never)));
  return Number(row?.count ?? 0);
}

async function countCommitments(userId: string, status: string): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(commitments).where(and(eq(commitments.userId, userId), eq(commitments.status, status as never)));
  return Number(row?.count ?? 0);
}

async function countFollowups(userId: string, status: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(followupSuggestions)
    .where(and(eq(followupSuggestions.userId, userId), eq(followupSuggestions.status, status as never)));
  return Number(row?.count ?? 0);
}

async function countMeetingPacks(userId: string): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(meetingPacks).where(eq(meetingPacks.userId, userId));
  return Number(row?.count ?? 0);
}

async function countActionProposals(userId: string, status: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(actionProposals)
    .where(and(eq(actionProposals.userId, userId), eq(actionProposals.status, status as never)));
  return Number(row?.count ?? 0);
}

async function countRecentEvaluationWarnings(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(evaluationEvents)
    .where(and(eq(evaluationEvents.userId, userId), eq(evaluationEvents.status, "warning")));
  return Number(row?.count ?? 0);
}

async function evaluationSummaryForUser(userId: string, targetType: string) {
  const rows = await db.execute(sql`
    SELECT status, count(*)::int AS count, coalesce(avg(score), 0)::real AS average_score
    FROM evaluation_events
    WHERE user_id = ${userId}::uuid AND target_type = ${targetType}
    GROUP BY status
    ORDER BY status
  `);
  return {
    targetType,
    events: rows.rows,
  };
}

async function streamSubagentNotifications(
  request: FastifyRequest,
  reply: FastifyReply,
  args: { userId: string; taskId?: string; sessionId?: string },
) {
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  reply.raw.write(": connected\n\n");
  let closed = false;
  let since = new Date(Date.now() - 1000);
  request.raw.on("close", () => {
    closed = true;
  });
  const send = (eventType: string, payload: unknown) => {
    reply.raw.write(`event: ${eventType}\n`);
    reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  const interval = setInterval(async () => {
    if (closed) {
      clearInterval(interval);
      reply.raw.end();
      return;
    }
    try {
      const notifications = await listSubagentNotifications({ userId: args.userId, since, taskId: args.taskId, limit: 100 });
      for (const notification of notifications ?? []) {
        if (args.sessionId && notification.sessionId !== args.sessionId) continue;
        since = notification.createdAt;
        send(notification.eventType, notification);
      }
      reply.raw.write(": keepalive\n\n");
    } catch (err) {
      send("subagent_failed", { message: (err as Error).message });
    }
  }, 1000);
  return reply;
}

function isOpsAdminRequest(request: FastifyRequest): boolean {
  const expected = config.OPS_CONSOLE_ADMIN_TOKEN;
  if (!expected) return false;
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ") && header.slice("Bearer ".length).trim() === expected) return true;
  const query = request.query as { token?: string } | undefined;
  return query?.token === expected;
}

function applyOpsCors(request: FastifyRequest, reply: FastifyReply): void {
  if (!config.OPS_CONSOLE_ENABLED) return;
  const origin = request.headers.origin;
  if (!origin || !isAllowedOpsOrigin(origin)) return;
  reply.header("Access-Control-Allow-Origin", origin);
  reply.header("Vary", "Origin");
  reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Authorization,Content-Type");
  reply.header("Access-Control-Max-Age", "600");
}

function isAllowedOpsOrigin(origin: string): boolean {
  const allowed = config.OPS_CONSOLE_ALLOWED_ORIGINS.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (allowed.length === 0) return false;
  return allowed.includes(origin);
}

async function main(): Promise<void> {
  const app = await buildServer();
  await app.listen({ host: config.HOST, port: config.PORT });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
