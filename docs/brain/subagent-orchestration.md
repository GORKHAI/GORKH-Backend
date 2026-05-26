# Subagent Orchestration v0

GORKH subagents are bounded internal task workers. They do not speak directly to the user and they do not own product policy. The main agent remains responsible for user-facing language, safety framing, and delivery channel decisions.

## Task Lifecycle

Subagent tasks move through:

- `queued`
- `running`
- `completed`
- `failed`
- `canceled`
- `expired`
- `suppressed`

Tasks are stored in `subagent_tasks`, progress is stored in `subagent_events`, and structured results are stored in `subagent_reports`.

The v0 scheduler is an in-process worker pool controlled by:

- `SUBAGENTS_ENABLED`
- `SUBAGENT_MAX_CONCURRENCY`
- `SUBAGENT_DEFAULT_TIMEOUT_MS`
- `SUBAGENT_RESEARCH_TIMEOUT_MS`
- `SUBAGENT_REPORT_MAX_CHARS`
- `SUBAGENT_LIVE_REPORT_SCREEN_ONLY`

## Workers

Implemented workers:

- `research`
- `source_verifier`
- `memory_lookup`
- `skill_matcher`
- `stress_support`
- `profile_context`

Research uses only configured public research providers. If no provider is configured, it returns `provider_not_configured` and does not invent citations.

## Live Sessions

In `conversation_agent`, the main agent can immediately answer while a research subagent runs in the background.

In `whisper_copilot`, deterministic cues are emitted first. Research is screen-only and must not produce long earbud speech.

## Session Privacy

Discarded and interrupted sessions suppress pending subagents. Discard deletes reports tied to that session. Saved sessions may retain safe subagent reports for review/reflection, but sensitive facts still require explicit confirmation.
