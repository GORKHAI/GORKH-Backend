import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { config } from "../config.js";

export type InternalType =
  | "bank_loan"
  | "doctor_visit"
  | "business_meeting"
  | "negotiation"
  | "sales_call"
  | "job_interview"
  | "legal_consultation"
  | "personal_conversation"
  | "general";

export type RiskLevel = "low" | "medium" | "high";
export type SessionStatus = "active" | "interrupted" | "saved" | "discarded";
export type RetentionPolicy = "save_on_stop" | "discard_on_stop" | "ask_on_stop";
export type MemoryKind = "commitment" | "fact" | "person" | "decision" | "preference";
export type VoicePolicy = "conversation_agent" | "whisper_copilot";
export type InputKind = "text" | "audio_pcm16";
export type OutputKind = "text" | "tts" | "both";
export type VoiceState = "starting" | "listening" | "thinking" | "speaking" | "stopped" | "interrupted" | "discarded";
export type AgentRole = "user" | "assistant" | "system" | "cue";
export type AgentChannel = "text" | "transcript" | "cue" | "error";
export type VoiceOutputType = "assistant_text" | "cue" | "speak_request" | "tts_unavailable" | "cancel_speech" | "error";
export type VoiceOutputStatus = "queued" | "emitted" | "canceled" | "failed";
export type HumanFactKind =
  | "occupation"
  | "project"
  | "goal"
  | "preference"
  | "constraint"
  | "person"
  | "organization"
  | "routine"
  | "communication_style"
  | "stress_support_preference"
  | "sensitive_candidate";
export type HumanFactSource = "explicit_user" | "inferred" | "confirmed" | "imported";
export type Sensitivity = "low" | "medium" | "high" | "sensitive";
export type HumanFactStatus = "proposed" | "confirmed" | "rejected" | "expired";
export type ContextEntityType = "person" | "organization" | "project" | "place" | "product" | "topic";
export type FeedbackTargetType = "cue" | "assistant_text" | "suggestion" | "research_answer" | "memory" | "skill";
export type BrainReflectionType = "session_review" | "skill_candidate" | "profile_update" | "cue_quality" | "stress_support_review";
export type BrainReflectionStatus = "proposed" | "applied" | "rejected" | "ignored";
export type StressSupportType = "grounding" | "breathing" | "deescalation" | "reframe" | "pause" | "crisis_resource" | "no_action";
export type StressEventStatus = "emitted" | "suppressed" | "escalated" | "ignored";
export type ResearchStatus = "pending" | "completed" | "failed" | "skipped";
export type ResearchSourceType = "official" | "academic" | "news" | "company" | "forum" | "unknown";
export type ToolInvocationStatus = "pending" | "completed" | "failed" | "denied";
export type PermissionDecision = "allowed" | "denied" | "requires_user_approval";
export type SkillStatus = "proposed" | "approved" | "enabled" | "disabled" | "rejected";
export type SkillSource = "learned" | "manual" | "system";
export type SubagentKind =
  | "research"
  | "source_verifier"
  | "memory_lookup"
  | "skill_matcher"
  | "stress_support"
  | "profile_context"
  | "commitment"
  | "daily_brief"
  | "meeting_pack"
  | "followup";
export type SubagentTaskStatus = "queued" | "running" | "completed" | "failed" | "canceled" | "expired" | "suppressed";
export type SubagentTaskAttemptStatus = "started" | "completed" | "failed" | "retried" | "canceled" | "expired" | "suppressed";
export type SubagentPriority = "low" | "normal" | "high" | "urgent";
export type SubagentTrigger =
  | "user_request"
  | "research_needed"
  | "voice_session_side_channel"
  | "saved_session_reflection"
  | "skill_match"
  | "stress_support_request"
  | "profile_context_needed";
export type CommitmentSourceType = "transcript" | "user_text" | "assistant_text" | "document" | "manual" | "subagent_report";
export type CommitmentStatus = "proposed" | "confirmed" | "done" | "dismissed" | "overdue";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type TaskStatus = "proposed" | "accepted" | "scheduled" | "done" | "dismissed" | "expired";
export type DailyBriefStatus = "generated" | "stale" | "dismissed";
export type FollowupStatus = "proposed" | "accepted" | "dismissed" | "sent_elsewhere";
export type MeetingPackType = "prep" | "recap";
export type ActionSourceType = "voice" | "brain" | "daily" | "manual" | "subagent" | "connector";
export type ActionType =
  | "draft_email"
  | "propose_calendar_event"
  | "propose_reminder"
  | "draft_followup_message"
  | "create_task_from_commitment"
  | "research_watchlist_create"
  | "profile_fact_confirm"
  | "skill_enable";
export type ActionProposalStatus = "proposed" | "approved" | "rejected" | "executed" | "failed" | "expired";
export type ActionApprovalDecision = "approved" | "rejected";
export type ActionExecutionStatus = "completed" | "failed" | "blocked" | "dry_run";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const situationBriefs = pgTable(
  "situation_briefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    inferredType: text("inferred_type").$type<InternalType>().notNull(),
    userGoal: text("user_goal"),
    participants: jsonb("participants").$type<string[] | null>(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    playbookIds: jsonb("playbook_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    riskLevel: text("risk_level").$type<RiskLevel>().notNull().default("medium"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("situation_briefs_by_user").on(t.userId),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    situationBriefId: uuid("situation_brief_id").references(() => situationBriefs.id, {
      onDelete: "set null",
    }),
    internalType: text("internal_type").$type<InternalType>().notNull(),
    status: text("status").$type<SessionStatus>().notNull(),
    title: text("title"),
    consentGranted: boolean("consent_granted").notNull().default(false),
    retentionPolicy: text("retention_policy").$type<RetentionPolicy>().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => ({
    byUser: index("sessions_by_user").on(t.userId),
  }),
);

export const consentEvents = pgTable("consent_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  granted: boolean("granted").notNull(),
  method: text("method").notNull(),
  noticeText: text("notice_text").notNull(),
  participantCount: integer("participant_count"),
  jurisdiction: text("jurisdiction"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const transcriptSegments = pgTable(
  "transcript_segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    speaker: text("speaker").notNull(),
    text: text("text").notNull(),
    isFinal: boolean("is_final").notNull().default(true),
    offsetMs: integer("offset_ms").notNull().default(0),
    confidence: real("confidence"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bySession: index("transcript_by_session").on(t.sessionId),
  }),
);

export const suggestions = pgTable(
  "suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    triggerType: text("trigger_type").notNull(),
    card: jsonb("card").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bySession: index("suggestions_by_session").on(t.sessionId),
  }),
);

export const cueEvents = pgTable(
  "cue_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    triggerType: text("trigger_type").notNull(),
    cue: jsonb("cue").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bySession: index("cue_events_by_session").on(t.sessionId),
  }),
);

export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    kind: text("kind").$type<MemoryKind>().notNull(),
    subject: text("subject"),
    content: text("content").notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }),
    embedding: vector("embedding", { dimensions: config.VOYAGE_EMBED_DIM }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("memories_by_user").on(t.userId),
  }),
);

export const voiceSessions = pgTable(
  "voice_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    policy: text("policy").$type<VoicePolicy>().notNull(),
    inputKind: text("input_kind").$type<InputKind>().notNull(),
    outputKind: text("output_kind").$type<OutputKind>().notNull(),
    state: text("state").$type<VoiceState>().notNull(),
    ttsProvider: text("tts_provider").notNull().default("none"),
    currentSpeechId: text("current_speech_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bySession: index("voice_sessions_by_session").on(t.sessionId),
    byUser: index("voice_sessions_by_user").on(t.userId),
  }),
);

export const agentTurns = pgTable(
  "agent_turns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<AgentRole>().notNull(),
    channel: text("channel").$type<AgentChannel>().notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bySession: index("agent_turns_by_session").on(t.sessionId),
  }),
);

export const voiceOutputs = pgTable(
  "voice_outputs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    outputType: text("output_type").$type<VoiceOutputType>().notNull(),
    speechId: text("speech_id"),
    text: text("text"),
    status: text("status").$type<VoiceOutputStatus>().notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bySession: index("voice_outputs_by_session").on(t.sessionId),
    byUser: index("voice_outputs_by_user").on(t.userId),
  }),
);

export const humanProfiles = pgTable(
  "human_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    displayLabel: text("display_label"),
    primaryOccupation: text("primary_occupation"),
    occupationConfidence: real("occupation_confidence"),
    activeDomains: jsonb("active_domains").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    activeProjects: jsonb("active_projects").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    communicationStyle: jsonb("communication_style").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    assistantPreferences: jsonb("assistant_preferences").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    stressSupportOptIn: boolean("stress_support_opt_in").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("human_profiles_by_user").on(t.userId),
  }),
);

export const humanProfileFacts = pgTable(
  "human_profile_facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => humanProfiles.id, { onDelete: "cascade" }),
    kind: text("kind").$type<HumanFactKind>().notNull(),
    content: text("content").notNull(),
    sourceSessionId: uuid("source_session_id").references(() => sessions.id, { onDelete: "set null" }),
    source: text("source").$type<HumanFactSource>().notNull(),
    confidence: real("confidence").notNull(),
    sensitivity: text("sensitivity").$type<Sensitivity>().notNull(),
    status: text("status").$type<HumanFactStatus>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("human_profile_facts_by_user").on(t.userId),
    byProfile: index("human_profile_facts_by_profile").on(t.profileId),
  }),
);

export const contextEntities = pgTable(
  "context_entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entityType: text("entity_type").$type<ContextEntityType>().notNull(),
    name: text("name").notNull(),
    aliases: jsonb("aliases").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    description: text("description"),
    sensitivity: text("sensitivity").$type<Sensitivity>().notNull().default("low"),
    confidence: real("confidence").notNull().default(0.5),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("context_entities_by_user").on(t.userId),
  }),
);

export const contextRelationships = pgTable(
  "context_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fromEntityId: uuid("from_entity_id")
      .notNull()
      .references(() => contextEntities.id, { onDelete: "cascade" }),
    toEntityId: uuid("to_entity_id")
      .notNull()
      .references(() => contextEntities.id, { onDelete: "cascade" }),
    relationshipType: text("relationship_type").notNull(),
    confidence: real("confidence").notNull().default(0.5),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("context_relationships_by_user").on(t.userId),
  }),
);

export const userFeedbackEvents = pgTable(
  "user_feedback_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    targetType: text("target_type").$type<FeedbackTargetType>().notNull(),
    targetId: text("target_id"),
    rating: integer("rating"),
    feedback: text("feedback"),
    outcome: text("outcome"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("user_feedback_events_by_user").on(t.userId),
  }),
);

export const brainReflections = pgTable(
  "brain_reflections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    reflectionType: text("reflection_type").$type<BrainReflectionType>().notNull(),
    inputSummary: text("input_summary").notNull(),
    output: jsonb("output").notNull(),
    status: text("status").$type<BrainReflectionStatus>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("brain_reflections_by_user").on(t.userId),
    bySession: index("brain_reflections_by_session").on(t.sessionId),
  }),
);

export const stressEvents = pgTable(
  "stress_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    detectedSignal: text("detected_signal").notNull(),
    supportType: text("support_type").$type<StressSupportType>().notNull(),
    confidence: real("confidence").notNull(),
    userOptedIn: boolean("user_opted_in").notNull().default(false),
    content: text("content"),
    status: text("status").$type<StressEventStatus>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("stress_events_by_user").on(t.userId),
  }),
);

export const researchQueries = pgTable(
  "research_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    situationBriefId: uuid("situation_brief_id").references(() => situationBriefs.id, { onDelete: "set null" }),
    query: text("query").notNull(),
    normalizedQuery: text("normalized_query").notNull(),
    intent: text("intent").notNull(),
    provider: text("provider").notNull(),
    status: text("status").$type<ResearchStatus>().notNull(),
    requiresFreshness: boolean("requires_freshness").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    byUser: index("research_queries_by_user").on(t.userId),
  }),
);

export const researchSources = pgTable(
  "research_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    queryId: uuid("query_id")
      .notNull()
      .references(() => researchQueries.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title"),
    sourceType: text("source_type").$type<ResearchSourceType>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }),
    snippet: text("snippet"),
    extractedText: text("extracted_text"),
    credibilityScore: real("credibility_score"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byQuery: index("research_sources_by_query").on(t.queryId),
  }),
);

export const researchAnswers = pgTable(
  "research_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    queryId: uuid("query_id")
      .notNull()
      .references(() => researchQueries.id, { onDelete: "cascade" }),
    answer: text("answer").notNull(),
    citations: jsonb("citations").notNull(),
    confidence: real("confidence").notNull(),
    limitations: text("limitations"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byQuery: index("research_answers_by_query").on(t.queryId),
  }),
);

export const toolManifests = pgTable("tool_manifests", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  version: text("version").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  riskLevel: text("risk_level").notNull(),
  inputSchema: jsonb("input_schema").notNull(),
  outputSchema: jsonb("output_schema").notNull(),
  permissions: jsonb("permissions").$type<string[]>().notNull(),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const toolInvocations = pgTable(
  "tool_invocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    toolName: text("tool_name").notNull(),
    input: jsonb("input").notNull(),
    output: jsonb("output"),
    status: text("status").$type<ToolInvocationStatus>().notNull(),
    permissionDecision: text("permission_decision").$type<PermissionDecision>().notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    byUser: index("tool_invocations_by_user").on(t.userId),
  }),
);

export const skills = pgTable(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    triggerPattern: text("trigger_pattern").notNull(),
    steps: jsonb("steps").$type<string[]>().notNull(),
    status: text("status").$type<SkillStatus>().notNull(),
    source: text("source").$type<SkillSource>().notNull(),
    riskLevel: text("risk_level").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("skills_by_user").on(t.userId),
  }),
);

export const skillVersions = pgTable(
  "skill_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    manifest: jsonb("manifest").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bySkill: index("skill_versions_by_skill").on(t.skillId),
    byUser: index("skill_versions_by_user").on(t.userId),
  }),
);

export const brainAuditEvents = pgTable(
  "brain_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("brain_audit_events_by_user").on(t.userId),
  }),
);

export const subagentTasks = pgTable(
  "subagent_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    situationBriefId: uuid("situation_brief_id").references(() => situationBriefs.id, { onDelete: "set null" }),
    parentTurnId: text("parent_turn_id"),
    kind: text("kind").$type<SubagentKind>().notNull(),
    trigger: text("trigger").$type<SubagentTrigger>().notNull(),
    priority: text("priority").$type<SubagentPriority>().notNull(),
    status: text("status").$type<SubagentTaskStatus>().notNull(),
    input: jsonb("input").notNull(),
    policy: jsonb("policy").notNull(),
    timeoutMs: integer("timeout_ms").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(config.SUBAGENT_DEFAULT_MAX_ATTEMPTS),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lockedBy: text("locked_by"),
    leaseToken: text("lease_token"),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    idempotencyKey: text("idempotency_key"),
    dedupeKey: text("dedupe_key"),
    errorCode: text("error_code"),
    errorClass: text("error_class"),
    lastError: text("last_error"),
    completedBy: text("completed_by"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
  },
  (t) => ({
    byUser: index("subagent_tasks_by_user").on(t.userId),
    bySession: index("subagent_tasks_by_session").on(t.sessionId),
    byStatus: index("subagent_tasks_by_status").on(t.status),
    byStatusNextRun: index("subagent_tasks_by_status_next_run").on(t.status, t.nextRunAt),
    byLockedUntil: index("subagent_tasks_by_locked_until").on(t.lockedUntil),
    byUserStatus: index("subagent_tasks_by_user_status").on(t.userId, t.status),
  }),
);

export const subagentTaskAttempts = pgTable(
  "subagent_task_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => subagentTasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workerId: text("worker_id").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    status: text("status").$type<SubagentTaskAttemptStatus>().notNull(),
    errorCode: text("error_code"),
    errorClass: text("error_class"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
  },
  (t) => ({
    byTask: index("subagent_task_attempts_by_task").on(t.taskId),
  }),
);

export const subagentNotifications = pgTable(
  "subagent_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id").references(() => subagentTasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    delivered: boolean("delivered").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUserCreated: index("subagent_notifications_by_user_created").on(t.userId, t.createdAt),
    byTaskCreated: index("subagent_notifications_by_task_created").on(t.taskId, t.createdAt),
  }),
);

export const subagentReports = pgTable(
  "subagent_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => subagentTasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    kind: text("kind").$type<SubagentKind>().notNull(),
    status: text("status").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    findings: jsonb("findings").notNull(),
    recommendedMainAgentMessage: text("recommended_main_agent_message"),
    safetyNotes: jsonb("safety_notes").notNull(),
    providerStatus: jsonb("provider_status"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byTask: index("subagent_reports_by_task").on(t.taskId),
    byUser: index("subagent_reports_by_user").on(t.userId),
  }),
);

export const subagentEvents = pgTable(
  "subagent_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => subagentTasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byTask: index("subagent_events_by_task").on(t.taskId),
  }),
);

export const commitments = pgTable(
  "commitments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    sourceType: text("source_type").$type<CommitmentSourceType>().notNull(),
    sourceId: text("source_id"),
    owner: text("owner"),
    counterparty: text("counterparty"),
    title: text("title").notNull(),
    detail: text("detail"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: text("status").$type<CommitmentStatus>().notNull(),
    confidence: real("confidence").notNull(),
    sensitivity: text("sensitivity").$type<Sensitivity>().notNull().default("low"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("commitments_by_user").on(t.userId),
    byUserStatus: index("commitments_by_user_status").on(t.userId, t.status),
    byDue: index("commitments_by_due_at").on(t.dueAt),
  }),
);

export const taskItems = pgTable(
  "task_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    commitmentId: uuid("commitment_id").references(() => commitments.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    detail: text("detail"),
    priority: text("priority").$type<TaskPriority>().notNull(),
    status: text("status").$type<TaskStatus>().notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    suggestedAt: timestamp("suggested_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("task_items_by_user").on(t.userId),
    byUserStatus: index("task_items_by_user_status").on(t.userId, t.status),
    byDue: index("task_items_by_due_at").on(t.dueAt),
  }),
);

export const dailyBriefs = pgTable(
  "daily_briefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    briefDate: date("brief_date").notNull(),
    status: text("status").$type<DailyBriefStatus>().notNull(),
    summary: text("summary").notNull(),
    sections: jsonb("sections").notNull(),
    actionItems: jsonb("action_items").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("daily_briefs_by_user").on(t.userId),
    byUserDate: index("daily_briefs_by_user_date").on(t.userId, t.briefDate),
  }),
);

export const followupSuggestions = pgTable(
  "followup_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    personName: text("person_name"),
    organizationName: text("organization_name"),
    reason: text("reason").notNull(),
    suggestedMessage: text("suggested_message"),
    status: text("status").$type<FollowupStatus>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("followup_suggestions_by_user").on(t.userId),
    byUserStatus: index("followup_suggestions_by_user_status").on(t.userId, t.status),
  }),
);

export const meetingPacks = pgTable(
  "meeting_packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    situationBriefId: uuid("situation_brief_id").references(() => situationBriefs.id, { onDelete: "set null" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    packType: text("pack_type").$type<MeetingPackType>().notNull(),
    sections: jsonb("sections").notNull(),
    risks: jsonb("risks").notNull(),
    suggestedQuestions: jsonb("suggested_questions").notNull(),
    followups: jsonb("followups").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("meeting_packs_by_user").on(t.userId),
    bySession: index("meeting_packs_by_session").on(t.sessionId),
  }),
);

export const actionProposals = pgTable(
  "action_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    sourceType: text("source_type").$type<ActionSourceType>().notNull(),
    actionType: text("action_type").$type<ActionType>().notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    payload: jsonb("payload").notNull(),
    riskLevel: text("risk_level").$type<RiskLevel>().notNull(),
    status: text("status").$type<ActionProposalStatus>().notNull(),
    requiresApproval: boolean("requires_approval").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("action_proposals_by_user").on(t.userId),
    byUserStatus: index("action_proposals_by_user_status").on(t.userId, t.status),
    bySession: index("action_proposals_by_session").on(t.sessionId),
  }),
);

export const actionApprovals = pgTable(
  "action_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => actionProposals.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    decision: text("decision").$type<ActionApprovalDecision>().notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byProposal: index("action_approvals_by_proposal").on(t.proposalId),
    byUser: index("action_approvals_by_user").on(t.userId),
  }),
);

export const actionExecutionLogs = pgTable(
  "action_execution_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => actionProposals.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").$type<ActionExecutionStatus>().notNull(),
    result: jsonb("result"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byProposal: index("action_execution_logs_by_proposal").on(t.proposalId),
    byUser: index("action_execution_logs_by_user").on(t.userId),
  }),
);

export type User = typeof users.$inferSelect;
export type SituationBrief = typeof situationBriefs.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type TranscriptSegment = typeof transcriptSegments.$inferSelect;
export type Memory = typeof memories.$inferSelect;
export type VoiceSession = typeof voiceSessions.$inferSelect;
export type AgentTurn = typeof agentTurns.$inferSelect;
export type VoiceOutput = typeof voiceOutputs.$inferSelect;
export type HumanProfile = typeof humanProfiles.$inferSelect;
export type HumanProfileFact = typeof humanProfileFacts.$inferSelect;
export type Skill = typeof skills.$inferSelect;
export type SkillVersion = typeof skillVersions.$inferSelect;
export type ResearchQuery = typeof researchQueries.$inferSelect;
export type SubagentTask = typeof subagentTasks.$inferSelect;
export type SubagentReportRow = typeof subagentReports.$inferSelect;
export type SubagentNotification = typeof subagentNotifications.$inferSelect;
export type Commitment = typeof commitments.$inferSelect;
export type TaskItem = typeof taskItems.$inferSelect;
export type DailyBrief = typeof dailyBriefs.$inferSelect;
export type FollowupSuggestion = typeof followupSuggestions.$inferSelect;
export type MeetingPack = typeof meetingPacks.$inferSelect;
export type ActionProposal = typeof actionProposals.$inferSelect;
export type ActionApproval = typeof actionApprovals.$inferSelect;
export type ActionExecutionLog = typeof actionExecutionLogs.$inferSelect;
