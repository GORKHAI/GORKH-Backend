import pg from "pg";
import { config, requireKey } from "../config.js";

const { Pool } = pg;

export async function runMigration(): Promise<void> {
  const pool = new Pool({ connectionString: requireKey(config.DATABASE_URL, "DATABASE_URL") });
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    try {
      await pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    } catch (err) {
      throw new Error(`pgvector extension is required for memories.embedding: ${(err as Error).message}`);
    }

    const dim = config.VOYAGE_EMBED_DIM;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text UNIQUE NOT NULL,
        display_name text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS situation_briefs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        description text NOT NULL,
        inferred_type text NOT NULL,
        user_goal text,
        participants jsonb,
        scheduled_at timestamptz,
        playbook_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        risk_level text NOT NULL DEFAULT 'medium',
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        situation_brief_id uuid REFERENCES situation_briefs(id) ON DELETE SET NULL,
        internal_type text NOT NULL,
        status text NOT NULL,
        title text,
        consent_granted boolean NOT NULL DEFAULT false,
        retention_policy text NOT NULL,
        started_at timestamptz NOT NULL DEFAULT now(),
        ended_at timestamptz
      );

      CREATE TABLE IF NOT EXISTS consent_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        granted boolean NOT NULL,
        method text NOT NULL,
        notice_text text NOT NULL,
        participant_count integer,
        jurisdiction text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS transcript_segments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        speaker text NOT NULL,
        text text NOT NULL,
        is_final boolean NOT NULL DEFAULT true,
        offset_ms integer NOT NULL DEFAULT 0,
        confidence real,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS suggestions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        trigger_type text NOT NULL,
        card jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS cue_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        trigger_type text NOT NULL,
        cue jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS memories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
        kind text NOT NULL,
        subject text,
        content text NOT NULL,
        due_date timestamptz,
        embedding vector(${dim}),
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS voice_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        policy text NOT NULL,
        input_kind text NOT NULL,
        output_kind text NOT NULL,
        state text NOT NULL,
        tts_provider text NOT NULL DEFAULT 'none',
        current_speech_id text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS agent_turns (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role text NOT NULL,
        channel text NOT NULL,
        content text NOT NULL,
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS voice_outputs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        output_type text NOT NULL,
        speech_id text,
        text text,
        status text NOT NULL,
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS human_profiles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        display_label text,
        primary_occupation text,
        occupation_confidence real,
        active_domains jsonb NOT NULL DEFAULT '[]'::jsonb,
        active_projects jsonb NOT NULL DEFAULT '[]'::jsonb,
        communication_style jsonb NOT NULL DEFAULT '{}'::jsonb,
        assistant_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
        stress_support_opt_in boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS human_profile_facts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        profile_id uuid NOT NULL REFERENCES human_profiles(id) ON DELETE CASCADE,
        kind text NOT NULL,
        content text NOT NULL,
        source_session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
        source text NOT NULL,
        confidence real NOT NULL,
        sensitivity text NOT NULL,
        status text NOT NULL,
        expires_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS context_entities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        entity_type text NOT NULL,
        name text NOT NULL,
        aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
        description text,
        sensitivity text NOT NULL DEFAULT 'low',
        confidence real NOT NULL DEFAULT 0.5,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS context_relationships (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        from_entity_id uuid NOT NULL REFERENCES context_entities(id) ON DELETE CASCADE,
        to_entity_id uuid NOT NULL REFERENCES context_entities(id) ON DELETE CASCADE,
        relationship_type text NOT NULL,
        confidence real NOT NULL DEFAULT 0.5,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS user_feedback_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
        target_type text NOT NULL,
        target_id text,
        rating integer,
        feedback text,
        outcome text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS brain_reflections (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
        reflection_type text NOT NULL,
        input_summary text NOT NULL,
        output jsonb NOT NULL,
        status text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS stress_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
        detected_signal text NOT NULL,
        support_type text NOT NULL,
        confidence real NOT NULL,
        user_opted_in boolean NOT NULL DEFAULT false,
        content text,
        status text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS research_queries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
        situation_brief_id uuid REFERENCES situation_briefs(id) ON DELETE SET NULL,
        query text NOT NULL,
        normalized_query text NOT NULL,
        intent text NOT NULL,
        provider text NOT NULL,
        status text NOT NULL,
        requires_freshness boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz
      );

      CREATE TABLE IF NOT EXISTS research_sources (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        query_id uuid NOT NULL REFERENCES research_queries(id) ON DELETE CASCADE,
        url text NOT NULL,
        title text,
        source_type text NOT NULL,
        published_at timestamptz,
        fetched_at timestamptz,
        snippet text,
        extracted_text text,
        credibility_score real,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS research_answers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        query_id uuid NOT NULL REFERENCES research_queries(id) ON DELETE CASCADE,
        answer text NOT NULL,
        citations jsonb NOT NULL,
        confidence real NOT NULL,
        limitations text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS tool_manifests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text UNIQUE NOT NULL,
        version text NOT NULL,
        description text NOT NULL,
        category text NOT NULL,
        risk_level text NOT NULL,
        input_schema jsonb NOT NULL,
        output_schema jsonb NOT NULL,
        permissions jsonb NOT NULL,
        enabled boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS tool_invocations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
        tool_name text NOT NULL,
        input jsonb NOT NULL,
        output jsonb,
        status text NOT NULL,
        permission_decision text NOT NULL,
        error text,
        created_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz
      );

      CREATE TABLE IF NOT EXISTS skills (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name text NOT NULL,
        description text NOT NULL,
        trigger_pattern text NOT NULL,
        steps jsonb NOT NULL,
        status text NOT NULL,
        source text NOT NULL,
        risk_level text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS skill_versions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        version integer NOT NULL,
        manifest jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS brain_audit_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES users(id) ON DELETE CASCADE,
        session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
        event_type text NOT NULL,
        payload jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS subagent_tasks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
        situation_brief_id uuid REFERENCES situation_briefs(id) ON DELETE SET NULL,
        parent_turn_id text,
        kind text NOT NULL,
        trigger text NOT NULL,
        priority text NOT NULL,
        status text NOT NULL,
        input jsonb NOT NULL,
        policy jsonb NOT NULL,
        timeout_ms integer NOT NULL,
        error text,
        created_at timestamptz NOT NULL DEFAULT now(),
        started_at timestamptz,
        completed_at timestamptz,
        canceled_at timestamptz
      );

      ALTER TABLE subagent_tasks ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
      ALTER TABLE subagent_tasks ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3;
      ALTER TABLE subagent_tasks ADD COLUMN IF NOT EXISTS next_run_at timestamptz;
      ALTER TABLE subagent_tasks ADD COLUMN IF NOT EXISTS locked_at timestamptz;
      ALTER TABLE subagent_tasks ADD COLUMN IF NOT EXISTS locked_until timestamptz;
      ALTER TABLE subagent_tasks ADD COLUMN IF NOT EXISTS locked_by text;
      ALTER TABLE subagent_tasks ADD COLUMN IF NOT EXISTS lease_token text;
      ALTER TABLE subagent_tasks ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz;
      ALTER TABLE subagent_tasks ADD COLUMN IF NOT EXISTS idempotency_key text;
      ALTER TABLE subagent_tasks ADD COLUMN IF NOT EXISTS dedupe_key text;
      ALTER TABLE subagent_tasks ADD COLUMN IF NOT EXISTS error_code text;
      ALTER TABLE subagent_tasks ADD COLUMN IF NOT EXISTS error_class text;
      ALTER TABLE subagent_tasks ADD COLUMN IF NOT EXISTS last_error text;
      ALTER TABLE subagent_tasks ADD COLUMN IF NOT EXISTS completed_by text;

      CREATE TABLE IF NOT EXISTS subagent_reports (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id uuid NOT NULL REFERENCES subagent_tasks(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
        kind text NOT NULL,
        status text NOT NULL,
        title text NOT NULL,
        summary text NOT NULL,
        findings jsonb NOT NULL,
        recommended_main_agent_message text,
        safety_notes jsonb NOT NULL,
        provider_status jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS subagent_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id uuid NOT NULL REFERENCES subagent_tasks(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
        event_type text NOT NULL,
        payload jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS subagent_task_attempts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id uuid NOT NULL REFERENCES subagent_tasks(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        worker_id text NOT NULL,
        attempt_number integer NOT NULL,
        status text NOT NULL,
        error_code text,
        error_class text,
        error_message text,
        started_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz,
        duration_ms integer
      );

      CREATE TABLE IF NOT EXISTS subagent_notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id uuid REFERENCES subagent_tasks(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
        event_type text NOT NULL,
        payload jsonb NOT NULL,
        delivered boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS commitments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
        source_type text NOT NULL,
        source_id text,
        owner text,
        counterparty text,
        title text NOT NULL,
        detail text,
        due_at timestamptz,
        status text NOT NULL,
        confidence real NOT NULL,
        sensitivity text NOT NULL DEFAULT 'low',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS task_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
        commitment_id uuid REFERENCES commitments(id) ON DELETE SET NULL,
        title text NOT NULL,
        detail text,
        priority text NOT NULL,
        status text NOT NULL,
        source_type text NOT NULL,
        source_id text,
        due_at timestamptz,
        suggested_at timestamptz NOT NULL DEFAULT now(),
        accepted_at timestamptz,
        completed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS daily_briefs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        brief_date date NOT NULL,
        status text NOT NULL,
        summary text NOT NULL,
        sections jsonb NOT NULL,
        action_items jsonb NOT NULL,
        generated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS followup_suggestions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
        person_name text,
        organization_name text,
        reason text NOT NULL,
        suggested_message text,
        status text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS meeting_packs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        situation_brief_id uuid REFERENCES situation_briefs(id) ON DELETE SET NULL,
        session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
        title text NOT NULL,
        pack_type text NOT NULL,
        sections jsonb NOT NULL,
        risks jsonb NOT NULL,
        suggested_questions jsonb NOT NULL,
        followups jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS action_proposals (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
        source_type text NOT NULL,
        action_type text NOT NULL,
        title text NOT NULL,
        description text NOT NULL,
        payload jsonb NOT NULL,
        risk_level text NOT NULL,
        status text NOT NULL,
        requires_approval boolean NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS action_approvals (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        proposal_id uuid NOT NULL REFERENCES action_proposals(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        decision text NOT NULL,
        reason text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS action_execution_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        proposal_id uuid NOT NULL REFERENCES action_proposals(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status text NOT NULL,
        result jsonb,
        error text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS transcript_by_session ON transcript_segments(session_id);
      CREATE INDEX IF NOT EXISTS sessions_by_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS situation_briefs_by_user ON situation_briefs(user_id);
      CREATE INDEX IF NOT EXISTS memories_by_user ON memories(user_id);
      CREATE INDEX IF NOT EXISTS suggestions_by_session ON suggestions(session_id);
      CREATE INDEX IF NOT EXISTS cue_events_by_session ON cue_events(session_id);
      CREATE INDEX IF NOT EXISTS voice_sessions_by_session ON voice_sessions(session_id);
      CREATE INDEX IF NOT EXISTS voice_sessions_by_user ON voice_sessions(user_id);
      CREATE INDEX IF NOT EXISTS agent_turns_by_session ON agent_turns(session_id);
      CREATE INDEX IF NOT EXISTS voice_outputs_by_session ON voice_outputs(session_id);
      CREATE INDEX IF NOT EXISTS voice_outputs_by_user ON voice_outputs(user_id);
      CREATE INDEX IF NOT EXISTS human_profiles_by_user ON human_profiles(user_id);
      CREATE INDEX IF NOT EXISTS human_profile_facts_by_user ON human_profile_facts(user_id);
      CREATE INDEX IF NOT EXISTS human_profile_facts_by_profile ON human_profile_facts(profile_id);
      CREATE INDEX IF NOT EXISTS context_entities_by_user ON context_entities(user_id);
      CREATE INDEX IF NOT EXISTS context_relationships_by_user ON context_relationships(user_id);
      CREATE INDEX IF NOT EXISTS user_feedback_events_by_user ON user_feedback_events(user_id);
      CREATE INDEX IF NOT EXISTS brain_reflections_by_user ON brain_reflections(user_id);
      CREATE INDEX IF NOT EXISTS brain_reflections_by_session ON brain_reflections(session_id);
      CREATE INDEX IF NOT EXISTS stress_events_by_user ON stress_events(user_id);
      CREATE INDEX IF NOT EXISTS research_queries_by_user ON research_queries(user_id);
      CREATE INDEX IF NOT EXISTS research_sources_by_query ON research_sources(query_id);
      CREATE INDEX IF NOT EXISTS research_answers_by_query ON research_answers(query_id);
      CREATE INDEX IF NOT EXISTS tool_invocations_by_user ON tool_invocations(user_id);
      CREATE INDEX IF NOT EXISTS skills_by_user ON skills(user_id);
      CREATE INDEX IF NOT EXISTS skill_versions_by_skill ON skill_versions(skill_id);
      CREATE INDEX IF NOT EXISTS skill_versions_by_user ON skill_versions(user_id);
      CREATE INDEX IF NOT EXISTS brain_audit_events_by_user ON brain_audit_events(user_id);
      CREATE INDEX IF NOT EXISTS subagent_tasks_by_user ON subagent_tasks(user_id);
      CREATE INDEX IF NOT EXISTS subagent_tasks_by_session ON subagent_tasks(session_id);
      CREATE INDEX IF NOT EXISTS subagent_tasks_by_status ON subagent_tasks(status);
      CREATE INDEX IF NOT EXISTS subagent_tasks_by_status_next_run ON subagent_tasks(status, next_run_at);
      CREATE INDEX IF NOT EXISTS subagent_tasks_by_locked_until ON subagent_tasks(locked_until);
      CREATE INDEX IF NOT EXISTS subagent_tasks_by_user_status ON subagent_tasks(user_id, status);
      CREATE INDEX IF NOT EXISTS subagent_reports_by_task ON subagent_reports(task_id);
      CREATE INDEX IF NOT EXISTS subagent_reports_by_user ON subagent_reports(user_id);
      CREATE INDEX IF NOT EXISTS subagent_events_by_task ON subagent_events(task_id);
      CREATE INDEX IF NOT EXISTS subagent_task_attempts_by_task ON subagent_task_attempts(task_id);
      CREATE INDEX IF NOT EXISTS subagent_notifications_by_user_created ON subagent_notifications(user_id, created_at);
      CREATE INDEX IF NOT EXISTS subagent_notifications_by_task_created ON subagent_notifications(task_id, created_at);
      CREATE INDEX IF NOT EXISTS commitments_by_user ON commitments(user_id);
      CREATE INDEX IF NOT EXISTS commitments_by_user_status ON commitments(user_id, status);
      CREATE INDEX IF NOT EXISTS commitments_by_due_at ON commitments(due_at);
      CREATE INDEX IF NOT EXISTS task_items_by_user ON task_items(user_id);
      CREATE INDEX IF NOT EXISTS task_items_by_user_status ON task_items(user_id, status);
      CREATE INDEX IF NOT EXISTS task_items_by_due_at ON task_items(due_at);
      CREATE INDEX IF NOT EXISTS daily_briefs_by_user ON daily_briefs(user_id);
      CREATE INDEX IF NOT EXISTS daily_briefs_by_user_date ON daily_briefs(user_id, brief_date);
      CREATE INDEX IF NOT EXISTS followup_suggestions_by_user ON followup_suggestions(user_id);
      CREATE INDEX IF NOT EXISTS followup_suggestions_by_user_status ON followup_suggestions(user_id, status);
      CREATE INDEX IF NOT EXISTS meeting_packs_by_user ON meeting_packs(user_id);
      CREATE INDEX IF NOT EXISTS meeting_packs_by_session ON meeting_packs(session_id);
      CREATE INDEX IF NOT EXISTS action_proposals_by_user ON action_proposals(user_id);
      CREATE INDEX IF NOT EXISTS action_proposals_by_user_status ON action_proposals(user_id, status);
      CREATE INDEX IF NOT EXISTS action_proposals_by_session ON action_proposals(session_id);
      CREATE INDEX IF NOT EXISTS action_approvals_by_proposal ON action_approvals(proposal_id);
      CREATE INDEX IF NOT EXISTS action_approvals_by_user ON action_approvals(user_id);
      CREATE INDEX IF NOT EXISTS action_execution_logs_by_proposal ON action_execution_logs(proposal_id);
      CREATE INDEX IF NOT EXISTS action_execution_logs_by_user ON action_execution_logs(user_id);
    `);

    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'memories_embedding_hnsw'
        ) THEN
          CREATE INDEX memories_embedding_hnsw ON memories USING hnsw (embedding vector_cosine_ops);
        END IF;
      END $$;
    `);
    console.log("migration: schema is up to date");
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration().catch((err) => {
    console.error(`migration: failed: ${(err as Error).message}`);
    process.exit(1);
  });
}
