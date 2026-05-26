# realhand-engine

Backend foundation for a real-time AI situational copilot mobile app. The app is explicit-session, consent-first, and privacy-first: users create natural situation briefs, then start Live Assist only for a specific conversation.

The backend works without Anthropic, Deepgram, Voyage, or TTS provider keys for text-source sessions: it creates users, creates situation briefs, accepts authenticated WebSocket transcript events, classifies triggers, emits deterministic fast cues, and answers preparation questions from playbooks.

## Architecture

GORKH-Backend is the intelligence/control plane. It owns auth, consent, situations, triggers, cues, memory, privacy, retention, and state. `services/voice-gateway` is a separate media bridge for mobile/client transport. It forwards client text/transcripts, bridges future ASR, and converts backend `voice_speak_request` events into client-side TTS instructions. It does not implement NVIDIA/Pipecat/Riva/PersonaPlex in this milestone.

```text
src/
  server.ts              Fastify HTTP + WebSocket server
  db/schema.ts           Drizzle tables
  session/manager.ts     live session lifecycle and privacy rules
  voice/*                provider-agnostic voice control plane
  cue/fast-cues.ts       deterministic headphone/screen cues
  situation/*            rule-based inference, playbooks, safety boundaries
  trigger/classifier.ts  deterministic trigger detection
  memory/*               Voyage/Anthropic provider-backed memory paths
  asr/deepgram.ts        real Deepgram live ASR wrapper
services/voice-gateway/
  src/server.ts          Fastify gateway HTTP + WebSocket server
  src/session.ts         gateway lifecycle, consent, ASR/backend bridge
  src/asr/*              ASR provider interface, none, Deepgram adapter
```

See [docs/voice-gateway-architecture.md](docs/voice-gateway-architecture.md) for the future media gateway shape.

## Local Codespace Setup

```bash
npm install
npm run setup:local
npm run dev
```

`npm run setup:local` creates `.env` only if missing, generates a secure `JWT_SECRET` without printing it, starts Docker Compose Postgres/pgvector + Redis, waits for health, runs migrations, and checks infrastructure.

`.env` is ignored by git and `npm run dev:env` never overwrites an existing `.env`.

## Commands

```bash
npm run typecheck
npm test
npm run build
npm run test:integration
npm run db:push
npm run check:infra
npm run replay -- bank
npm run replay -- meeting
npm run replay -- doctor
npm run replay:all
npm run voice:replay -- prep-bank
npm run voice:replay -- whisper-bank
npm run voice:replay -- prep-doctor
npm run voice:replay -- whisper-doctor
npm run voice:replay:all
npm run gateway:dev
npm run gateway:test
npm run gateway:build
npm run gateway:test:integration
npm run gateway:replay -- text-prep-bank
npm run gateway:replay:all
```

`npm test` is unit-only and requires no Postgres, Redis, or provider keys. `npm run test:integration` requires real local Postgres and Redis.

## Providers

Optional provider keys:

```text
LLM_PROVIDER          none, deepseek, or anthropic; default deepseek
DEEPSEEK_API_KEY     low-cost open-ended assistant responses, suggestions, memory extraction
ANTHROPIC_API_KEY   open-ended assistant responses, suggestions, memory extraction
DEEPGRAM_API_KEY    live audio transcription
VOYAGE_API_KEY      embeddings and memory search/storage
```

DeepSeek defaults:

```text
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_CHAT_MODEL=deepseek-v4-flash
DEEPSEEK_REASONING_MODEL=deepseek-v4-pro
DEEPSEEK_TIMEOUT_MS=15000
DEEPSEEK_MAX_RETRIES=1
DEEPSEEK_THINKING=disabled
```

`deepseek-v4-flash` is the default low-cost model for development. Reasoning/thinking mode is disabled for speed and cost until provider behavior is validated.

Voice config:

```text
VOICE_MAX_SPOKEN_WORDS=8
VOICE_CUE_MIN_INTERVAL_MS=5000
VOICE_AGENT_RESPONSE_MAX_CHARS=1200
VOICE_DEFAULT_OUTPUT=text
VOICE_TTS_PROVIDER=none
```

`VOICE_TTS_PROVIDER=none` means the backend may emit `voice_speak_request` text, but it must not emit fake audio chunks. If the client requests TTS/audio output while provider is `none`, the backend emits `voice_tts_unavailable` and still returns assistant/cue text.

Gateway config:

```text
VOICE_GATEWAY_HOST=0.0.0.0
VOICE_GATEWAY_PORT=3010
GORKH_BACKEND_HTTP_URL=http://127.0.0.1:3000
GORKH_BACKEND_WS_URL=ws://127.0.0.1:3000
VOICE_GATEWAY_ASR_PROVIDER=none
VOICE_GATEWAY_OUTPUT_STRATEGY=client_tts
GATEWAY_MAX_PCM_FRAME_BYTES=64000
GATEWAY_SESSION_IDLE_TIMEOUT_MS=120000
GATEWAY_BACKEND_CONNECT_TIMEOUT_MS=10000
```

`VOICE_GATEWAY_OUTPUT_STRATEGY=client_tts` means the gateway never generates audio. It forwards backend `voice_speak_request` and also emits `gateway_client_tts_instruction` so iOS/Android can speak locally with native TTS and route playback to earbuds.

For live microphone tests, set:

```text
VOICE_GATEWAY_ASR_PROVIDER=deepgram
DEEPGRAM_API_KEY=<real key>
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=<optional real key>
```

## Health

`GET /health` actively checks DB `SELECT 1`, Redis `PING`, and provider-key presence.

`GET /health/ready` returns 200 only when DB and Redis are reachable. Provider keys do not affect readiness.

## HTTP Routes

Development:

```text
POST /dev/users
```

Authenticated situation/session routes:

```text
POST /situations
GET /situations/:id
GET /sessions/:id
GET /sessions/:id/transcript
GET /sessions/:id/cues
GET /sessions/:id/suggestions
GET /sessions/:id/turns
GET /sessions/:id/voice-outputs
GET /sessions/:id/voice-session
```

All read/debug endpoints enforce ownership. User B cannot access User A’s sessions, transcripts, cues, suggestions, voice turns, voice outputs, or voice session state.

## Daily Life Brain

Daily Life Brain v0 adds reviewable daily usefulness primitives:

- Daily Brief
- Commitment Tracker
- Personal Task Inbox
- Follow-up Detector
- Meeting Prep and Recap Packs

Routes:

```text
POST /daily/brief/generate
GET  /daily/brief/today
GET  /daily/tasks
POST /daily/tasks/:id/accept
POST /daily/tasks/:id/dismiss
POST /daily/tasks/:id/done
GET  /daily/commitments
POST /daily/commitments/propose
POST /daily/commitments/:id/confirm
POST /daily/commitments/:id/dismiss
GET  /daily/followups
POST /meetings/prep-pack
POST /meetings/recap-pack
GET  /meetings/packs
GET  /meetings/packs/:id
```

Commitments and tasks extracted from conversations are proposed only. The backend never sends messages, books appointments, submits forms, or executes external actions in v0. Discarded and interrupted sessions do not create daily-life artifacts.

Daily replay commands:

```bash
npm run daily:replay -- extract-commitments
npm run daily:replay -- task-inbox
npm run daily:replay -- daily-brief
npm run daily:replay -- meeting-prep-pack
npm run daily:replay -- meeting-recap-pack
npm run daily:replay -- voice-open-commitments
npm run daily:replay -- discard-no-extraction
npm run daily:replay:all
```

See:

- [docs/brain/daily-life-brain.md](docs/brain/daily-life-brain.md)
- [docs/brain/commitment-tracker.md](docs/brain/commitment-tracker.md)
- [docs/brain/task-inbox.md](docs/brain/task-inbox.md)
- [docs/brain/daily-brief-engine.md](docs/brain/daily-brief-engine.md)
- [docs/brain/meeting-pack-workflow.md](docs/brain/meeting-pack-workflow.md)

Adaptive Brain routes:

```text
GET /human/profile
GET /human/profile/review
POST /human/profile/facts/:id/confirm
POST /human/profile/facts/:id/reject
GET /human/context-summary
POST /stress/opt-in
POST /stress/opt-out
POST /stress/support
GET /stress/settings
POST /brain/query
GET /brain/reflections
GET /brain/audit-events
GET /brain/dashboard
POST /research/query
GET /research/query/:id
GET /research/providers
GET /tools
GET /tools/permissions
POST /tools/:name/invoke
GET /skills
POST /skills/match
POST /skills/:id/approve
POST /skills/:id/enable
POST /skills/:id/disable
POST /feedback
```

## Live Session WebSocket

`/session` is the Milestone 1/2 live assist socket for transcript ingestion and deterministic cues. It requires JWT auth through `Authorization: Bearer <token>` or `?token=<token>`.

## Voice Control Plane

`/voice` is the provider-agnostic voice control WebSocket. It also requires JWT auth and never accepts `userId` in client messages.

Policies:

- `conversation_agent`: normal user-to-AI conversation before/after a situation; may produce normal assistant text
- `whisper_copilot`: live real-world situation support; produces rare, short tactical cues suitable for earbuds

Start event:

```json
{
  "type": "start",
  "policy": "whisper_copilot",
  "situationBriefId": "<optional uuid>",
  "situationDescription": "I am talking with a bank about a loan",
  "title": "Bank loan live assist",
  "consent": {
    "granted": true,
    "method": "user_tap",
    "noticeText": "Live Assist is active. I confirm I have the right consent for this conversation.",
    "participantCount": 2,
    "jurisdiction": "unknown"
  },
  "input": { "kind": "text" },
  "output": { "kind": "both" },
  "retentionPolicy": "ask_on_stop"
}
```

Client events:

```json
{ "type": "user_text", "text": "What should I ask before this bank meeting?" }
{ "type": "transcript", "speaker": "speaker_1", "text": "The APR is 9.4 percent.", "offsetMs": 1200 }
{ "type": "speech_started" }
{ "type": "speech_ended" }
{ "type": "stop", "save": false }
```

Binary frames are accepted only when `input.kind` is `audio_pcm16`, consent is granted, and `DEEPGRAM_API_KEY` is configured. Audio is PCM16 16kHz mono.

Server events:

```text
voice_ack
voice_state
voice_segment
voice_triggers
voice_cue
voice_assistant_text
voice_speak_request
voice_tts_unavailable
voice_cancel_speech
summary
error
```

`speech_started` acts as barge-in. If the backend has an active `currentSpeechId`, it marks the corresponding voice output canceled and emits `voice_cancel_speech`.

## Voice Gateway

`/gateway/voice` is the external gateway WebSocket for mobile prototypes. It authenticates with the same JWT as the backend, verifies consent before any backend or ASR start, and never accepts `userId` in client messages.

Run backend and gateway locally:

```bash
npm run dev
npm run gateway:dev
```

Gateway health/debug routes:

```text
GET /health
GET /providers
GET /sessions/:gatewaySessionId
```

Gateway start example:

```json
{
  "type": "start",
  "policy": "whisper_copilot",
  "situationDescription": "I am talking with a bank about a loan",
  "title": "Bank loan live assist",
  "consent": {
    "granted": true,
    "method": "user_tap",
    "noticeText": "Live Assist is active. I confirm I have the right consent for this conversation.",
    "participantCount": 2,
    "jurisdiction": "unknown"
  },
  "input": { "kind": "text" },
  "output": { "kind": "both" },
  "retentionPolicy": "ask_on_stop"
}
```

For PCM input:

```json
{ "input": { "kind": "pcm16", "sampleRate": 16000, "channels": 1 } }
```

PCM frames are accepted only after consented start, only for `pcm16`, only when an ASR provider is available, and only up to `GATEWAY_MAX_PCM_FRAME_BYTES`. With `VOICE_GATEWAY_ASR_PROVIDER=none`, PCM start emits `gateway_provider_error` and no backend voice session is activated.

Gateway forwards backend events unchanged, including `voice_ack`, `voice_cue`, `voice_assistant_text`, `voice_speak_request`, `voice_cancel_speech`, `summary`, and `error`.

Client-side TTS contract:

- Backend emits `voice_speak_request` with `speechId`, text, and delivery.
- Gateway forwards it unchanged.
- Gateway also emits `gateway_client_tts_instruction`.
- The mobile app speaks that text locally using native TTS.
- If backend emits `voice_cancel_speech`, the mobile app stops local speech for that `speechId`.
- Gateway does not emit fake audio chunks.

## Consent And Retention

No `/session` or `/voice` session starts unless `consent.granted === true`. If consent is false, the backend does not create an active base session, does not create a voice session, does not open Deepgram, and does not accept binary audio.

Retention behavior:

- `stop.save=false`: status `discarded`; transcript, cues, suggestions, agent turns, voice outputs deleted; no memory extraction
- `stop.save=true`: status `saved`; memory extraction uses persisted transcript if providers are configured; missing providers emit clear errors
- disconnect with `save_on_stop`: status `interrupted`; content may remain; no memory extraction
- disconnect with `discard_on_stop`: status `interrupted`; sensitive content deleted; no memory extraction
- disconnect with `ask_on_stop`: status `interrupted`; content may remain temporarily; no memory extraction

Async provider jobs check lifecycle before writing. Late provider results after discard/interruption are ignored.

## Replay

Start the server first:

```bash
npm run dev
```

Then run text-session replays:

```bash
npm run replay -- bank
npm run replay -- meeting
npm run replay -- doctor
npm run replay:all
```

Voice replays:

```bash
npm run voice:replay -- prep-bank
npm run voice:replay -- whisper-bank
npm run voice:replay -- prep-doctor
npm run voice:replay -- whisper-doctor
npm run voice:replay:all
```

Gateway replays:

```bash
npm run gateway:replay -- text-prep-bank
npm run gateway:replay -- text-whisper-bank
npm run gateway:replay -- text-prep-doctor
npm run gateway:replay -- text-whisper-doctor
npm run gateway:replay -- pcm-missing-asr
npm run gateway:replay:all
```

Voice prep replays use `conversation_agent` and deterministic playbook responses. Whisper replays use `whisper_copilot`, deterministic cue generation, `voice_speak_request`, and `voice_tts_unavailable` when `VOICE_TTS_PROVIDER=none`.

LLM replays:

```bash
npm run llm:check
npm run llm:replay -- open-ended-bank
npm run llm:replay -- suggestion-bank
npm run llm:replay:all
```

If `DEEPSEEK_API_KEY` is missing, LLM replays expect `provider_not_configured` and exit successfully when deterministic paths still work.

Adaptive Brain replays:

```bash
npm run brain:replay -- local-reference-inventory
npm run brain:replay -- implementation-audit-summary
npm run brain:replay -- profile-explicit
npm run brain:replay -- profile-inferred-proposed
npm run brain:replay -- profile-review
npm run brain:replay -- stress-support
npm run brain:replay -- stress-crisis-boundary
npm run brain:replay -- stress-settings
npm run brain:replay -- skill-proposal
npm run brain:replay -- skill-match
npm run brain:replay -- reflection-review
npm run brain:replay -- research-needed-no-provider
npm run brain:replay -- research-provider-status
npm run brain:replay -- tool-registry
npm run brain:replay -- dashboard
npm run brain:replay -- voice-profile-adaptation
npm run brain:replay:all
```

If research provider keys are missing, provider-live research is skipped clearly:

```bash
npm run research:replay:all
```

## Live Browser Prototype

Milestone 5 adds a local browser dev console served by the gateway:

```bash
npm run dev
npm run gateway:dev
npm run gateway:live:check
npm run gateway:live:open
```

Open `/dev/live` on the forwarded gateway port. The page can create a dev user, connect to `/gateway/voice`, start a consented session, push typed messages/transcripts, or capture browser microphone PCM16 through an AudioWorklet.

Microphone safety rules:

- browser `getUserMedia` starts only after the consent checkbox is checked and a gateway start is accepted
- PCM16 frames are sent only while the socket is open, consent is granted, and input mode is `microphone_pcm16`
- microphone tracks and AudioWorklet are stopped on Stop, Disconnect, or socket close
- the page shows a visible recording indicator and mic level meter

ASR routing:

- `conversation_agent`: ASR final text is forwarded to backend `/voice` as `user_text`
- `whisper_copilot`: ASR final text is forwarded as `transcript`
- typed user text always forwards `user_text`
- typed transcript always forwards `transcript`

Client-side TTS:

- the gateway does not generate server-side audio
- browser SpeechSynthesis speaks `gateway_client_tts_instruction.text` locally unless muted
- `voice_cancel_speech` cancels browser SpeechSynthesis
- mobile will replace browser SpeechSynthesis with native iOS/Android TTS and OS audio routing

The dev page is disabled when `NODE_ENV=production`.

Manual live checklist: [docs/live-audio-test-checklist.md](docs/live-audio-test-checklist.md).

## Adaptive Brain

Adaptive Brain v0 makes GORKH improve through safe personalization and reflection. It does not fine-tune itself.

What it stores:

- confirmed low-risk human profile facts, such as occupation/domain, active projects, goals, preferences, and recurring workflows
- proposed inferred facts that require confirmation
- stress support opt-in state
- user feedback
- proposed reusable workflow skills
- audit records for brain queries and tool invocations
- reviewable reflections, profile fact queues, skill matches, provider status, and safety dashboard summaries

What it does not do:

- no hidden memory writes
- no sensitive stress or psychological profile storage without opt-in and confirmation
- no diagnosis, treatment, psychotherapy, lie detection, emotion certainty, or manipulation advice
- no autonomous financial/legal/medical decisions
- no arbitrary shell execution
- no browser login/cookie/session access
- no form submission, purchases, or sending messages without approval

See:

- [docs/brain/adaptive-brain-v0-architecture.md](docs/brain/adaptive-brain-v0-architecture.md)
- [docs/brain/human-model-policy.md](docs/brain/human-model-policy.md)
- [docs/brain/self-improvement-policy.md](docs/brain/self-improvement-policy.md)
- [docs/brain/stress-support-policy.md](docs/brain/stress-support-policy.md)
- [docs/brain/research-tool-policy.md](docs/brain/research-tool-policy.md)
- [docs/brain/skill-learning-policy.md](docs/brain/skill-learning-policy.md)
- [docs/brain/external-agent-patterns-review.md](docs/brain/external-agent-patterns-review.md)
- [docs/brain/local-reference-codebase-inventory.md](docs/brain/local-reference-codebase-inventory.md)
- [docs/brain/local-reference-architecture-study.md](docs/brain/local-reference-architecture-study.md)
- [docs/brain/adaptive-brain-implementation-audit.md](docs/brain/adaptive-brain-implementation-audit.md)
- [docs/brain/gorkh-brain-hardening-plan.md](docs/brain/gorkh-brain-hardening-plan.md)

### Human Profile Engine

Explicit low-risk statements can create confirmed facts:

```text
I am a blockchain developer.
```

Inferred facts are proposed:

```text
Repeated Solana/mobile app context -> proposed occupation/domain fact
```

Sensitive facts remain proposed and require confirmation. Stress profile storage requires opt-in.

`GET /human/profile/review` returns confirmed facts, proposed facts, sensitive candidates, rejected facts, a confirmed-only profile summary, and pending actions.

### Self-Improvement Loop

Saved sessions can trigger reflection:

```text
observe -> reflect -> propose profile facts/skills -> confirm -> apply
```

Discarded and interrupted sessions do not trigger reflection, profile extraction, or skill creation.

`GET /brain/reflections`, `GET /brain/audit-events`, and `GET /brain/dashboard` expose the review/control surface for mobile clients.

### Skill Learning

Skills are reusable workflow templates, not code. Learned skills start as `proposed`; user approval is required before enablement. Skills that require shell execution, form submission, login browser access, payment, sending messages, diagnosis, manipulation, or unsafe high-risk advice are rejected.

`POST /skills/match` returns enabled matching skills only. Skill versions are recorded as minimal audit history when a skill is proposed.

### Stress Support

Stress support is support, not therapy. Safe responses include grounding, breathing reminders, pause suggestions, de-escalation phrases, and crisis-resource boundaries. For self-harm or immediate danger language, GORKH recommends local emergency/crisis support and says it is not an emergency service.

`GET /stress/settings` exposes opt-in status, locale, France 3114, US 988, and storage policy.

### Research Engine

Research need detection is deterministic. Current/latest/rates/laws/policies/source-verification requests route to research when `allowResearch=true`. If `RESEARCH_PROVIDER=none`, `/research/query` returns `provider_not_configured` and no sources or citations are fabricated.

`GET /research/providers` reports selected provider, configured status, available keys, browser provider, and fetch/browser restrictions. Browser provider remains `none`.

Research config:

```text
RESEARCH_PROVIDER=none
BRAVE_API_KEY=
TAVILY_API_KEY=
EXA_API_KEY=
RESEARCH_REQUIRE_CITATIONS=true
```

Provider-live validation commands:

```sh
npm run research:check
npm run research:replay -- bank-apr
npm run research:replay -- doctor-test-results
npm run research:replay -- company-brief
npm run research:replay:all
```

If no provider key is configured, these commands exit successfully with a clear `provider_not_configured` result. If a provider is configured, they require real source-backed results and never fabricate citations.

### Brain Console v0

The Voice Gateway serves a local browser control surface at `/dev/brain` when `NODE_ENV !== "production"`.

Use it to:

- create a dev user and hold a JWT in-memory/input only
- inspect `/brain/dashboard`
- review confirmed/proposed/sensitive/rejected profile facts
- confirm or reject profile facts
- opt in/out of stress support and test safe support text
- inspect, approve, enable, disable, and match skills
- inspect reflections and audit events
- inspect research provider status and run `/research/query` or `/brain/query`
- create, list, cancel, and inspect internal subagent tasks and reports
- inspect tool permissions and disabled dangerous capabilities
- inspect session privacy counts for saved/discarded/interrupted sessions
- open `/dev/live` for manual microphone validation

Brain Console does not store secrets in localStorage by default, does not perform hidden recording, and is disabled in production. See `docs/brain/brain-console-manual-test-checklist.md`.

### Durable Subagent Runtime v1

Subagents are internal bounded workers, not user-facing personalities. The main agent can keep talking while subagents run background work such as public research, source verification, profile context lookup, skill matching, or stress-support preparation.

Tasks are persisted in Postgres and can be executed by a durable DB worker. The worker claims queued tasks with row locks, writes attempt records, heartbeats a lease, retries transient failures with bounded backoff, and suppresses reports when a linked session is discarded or interrupted.

Core APIs:

```sh
POST /subagents/tasks
GET /subagents/tasks
GET /subagents/tasks/:id
GET /subagents/tasks/:id/report
POST /subagents/tasks/:id/cancel
GET /subagents/events/:taskId
GET /subagents/notifications
GET /subagents/stream
GET /sessions/:id/subagents/stream
GET /subagents/queue/status
GET /subagents/queue/metrics
GET /subagents/queue/failures
```

Production service split:

```sh
npm run api:start
npm run gateway:start
npm run worker:start
```

Development equivalents:

```sh
npm run api:dev
npm run gateway:dev
npm run worker:dev
```

Worker and queue commands:

```sh
npm run worker:health
npm run worker:metrics
npm run worker:once
npm run subagents:worker
npm run subagents:worker:once
npm run subagents:queue:inspect
npm run subagents:queue:reclaim-expired
npm run subagents:queue:cleanup-notifications
```

Deployment and smoke checks:

```sh
npm run env:check
npm run deploy:check
npm run render:preflight
npm run service:check
npm run production:smoke
npm run production:privacy-smoke
npm run security:no-secret-scan
```

`render.yaml` defines separate Render services for API, Voice Gateway, and durable worker. See `docs/deployment/render-neon-upstash.md`, `docs/security/no-secrets-runtime-policy.md`, and `docs/qa/production-smoke-checklist.md`.

Render deployment rehearsal:

```sh
npm run render:preflight
```

After deploying on Render, set the deployed URLs locally and run:

```sh
export LIVE_API_URL=<deployed-api-url>
export LIVE_GATEWAY_URL=<deployed-gateway-url>
export LIVE_API_WS_URL=<deployed-api-ws-url>
export LIVE_GATEWAY_WS_URL=<deployed-gateway-ws-url>
npm run render:postdeploy
```

If production disables `POST /dev/users`, provide a smoke-test JWT instead:

```sh
export LIVE_TEST_JWT=<smoke-user-jwt>
```

Live verification commands:

```sh
npm run live:verify
npm run live:verify:api
npm run live:verify:gateway
npm run live:verify:worker
npm run live:verify:brain
npm run live:verify:actions
npm run live:verify:research
npm run live:verify:privacy
npm run live:verify:prod-safety
```

These scripts require deployed `LIVE_*` URLs and never print provider keys or JWT secrets. They fail clearly when URLs are missing. They do not claim browser microphone ASR or provider-live research unless those paths are actually configured and observed.

Production must keep `/dev/live` and `/dev/brain` disabled. For browser-only staging validation, enable protected ops consoles only with:

```sh
OPS_CONSOLE_ENABLED=true
OPS_CONSOLE_ADMIN_TOKEN=<secret>
OPS_CONSOLE_ALLOW_TEST_USER=true
OPS_CONSOLE_ALLOWED_ORIGINS=https://voice.gorkh.com
```

Then open `https://voice.gorkh.com/ops/live?token=<ops-admin-token>` or `https://voice.gorkh.com/ops/brain?token=<ops-admin-token>`. Prefer a separate staging Render gateway/API for this flow. Disable `OPS_CONSOLE_ENABLED` again after testing if used on production.

Deployment runbooks:

- [docs/deployment/render-deploy-rehearsal.md](docs/deployment/render-deploy-rehearsal.md)
- [docs/deployment/render-env-checklist.md](docs/deployment/render-env-checklist.md)
- [docs/deployment/render-post-deploy-verification.md](docs/deployment/render-post-deploy-verification.md)
- [docs/deployment/render-service-runbook.md](docs/deployment/render-service-runbook.md)

Voice sessions emit:

- `voice_subagent_started`
- `voice_subagent_progress`
- `voice_subagent_report`
- `voice_subagent_failed`

The gateway forwards these events unchanged. `whisper_copilot` keeps fast deterministic cues first and treats research reports as screen-only, so long source summaries are not spoken into earbuds.

Replay commands:

```sh
npm run subagents:replay -- research-no-provider
npm run subagents:replay -- brain-query-subagent
npm run subagents:replay -- voice-research-sidechannel
npm run subagents:replay -- whisper-research-screen-only
npm run subagents:replay -- skill-match
npm run subagents:replay -- stress-support
npm run subagents:replay -- cancel-task
npm run subagents:replay -- durable-research-no-provider
npm run subagents:replay -- durable-brain-query
npm run subagents:replay -- worker-once
npm run subagents:replay -- reclaim-expired
npm run subagents:replay -- sse-notifications
npm run subagents:replay:all
npm run research:live:all
npm run subagents:live-research:all
npm run research:live:verify
npm run subagents:live-research:verify
```

See `docs/brain/subagent-orchestration.md`, `docs/brain/durable-subagent-runtime.md`, `docs/brain/subagent-worker-runbook.md`, `docs/brain/subagent-notification-stream.md`, `docs/brain/subagent-privacy-retention.md`, and `docs/brain/subagent-research-workflow.md`.

### Protected Browser Microphone Validation

The browser microphone path still requires manual validation from protected `/ops/live` on staging, or from local `/dev/live`. Use it to confirm:

- Deepgram ASR final events from real microphone audio
- conversation_agent routes ASR finals to `user_text`
- whisper_copilot routes ASR finals to `transcript`
- browser SpeechSynthesis speaks client-side TTS instructions
- stop/disconnect turns off microphone capture

Do not claim live ASR pass/fail unless a real browser microphone test is performed.

### Tool Registry

The v0 tool registry is allowlisted and restricted. Public web read tools can be allowed when providers are configured; dangerous permissions like `execute_code`, `submit_form`, `send_external_message`, and `access_private_browser_session` are denied.

`GET /tools/permissions` returns the permission model and disabled dangerous capabilities.

### Action Approval Engine

Action Approval Engine v0 turns user requests into reviewable proposals instead of autonomous external actions. Supported proposal types include draft email, calendar event proposal, reminder proposal, draft follow-up message, task-from-commitment, research watchlist, profile fact confirmation, and skill enablement.

Routes:

```text
GET  /actions/proposals
POST /actions/proposals
GET  /actions/proposals/:id
POST /actions/proposals/:id/approve
POST /actions/proposals/:id/reject
POST /actions/proposals/:id/execute
```

All proposals require approval. Safe internal actions may execute after approval; external connector actions return `connector_not_configured` in v0. GORKH does not send emails, create meetings, submit forms, make payments, access browser logins, or invoke arbitrary MCP tools.

Connector registry routes:

```text
GET /connectors
GET /connectors/:id
GET /connectors/:id/permissions
```

The connector manifest layer includes disabled-by-default manifests for Gmail, Google Calendar, Outlook, Notion, Slack, Todoist, GitHub, and remote MCP. MCP support is a restricted design surface only: no stdio execution, no shell spawning, no arbitrary remote server access, and no unregistered tool invocation.

Action replay commands:

```bash
npm run actions:replay -- draft-email-proposal
npm run actions:replay -- calendar-proposal
npm run actions:replay -- reminder-internal
npm run actions:replay -- connector-registry
npm run actions:replay -- mcp-disabled
npm run actions:replay -- approval-lifecycle
npm run actions:replay -- voice-draft-followup
npm run actions:replay:all
```

See `docs/actions/action-approval-engine.md`, `docs/connectors/connector-manifest-layer.md`, `docs/connectors/mcp-ready-design.md`, and `docs/security/external-action-policy.md`.

### Local Reference Audit

The uploaded Hermes Agent, OpenClaw, and NVIDIA PersonaPlex archives were verified locally and inspected statically. They were extracted into `.reference-agent-labs/`, which is gitignored. No external reference code was executed, installed, or integrated.

GORKH copied architecture patterns only: auditable reflection, declarative skills, provider routing, public research/fetch separation, voice gateway separation, and barge-in state control. GORKH explicitly does not copy executable skill expansion, plugin runtimes, arbitrary browser/shell actions, PersonaPlex/NVIDIA runtime code, or autonomous high-risk actions.

## Current Limitations

- No NVIDIA, Pipecat, PersonaPlex, or Riva integration is implemented.
- Gateway transport is WebSocket text/PCM for v0; WebRTC is a future transport.
- No fake audio is emitted; TTS provider is currently `none`.
- Situation inference, trigger classification, and fast cues are deterministic rule-based logic.
- Provider-backed suggestions, open-ended voice answers, and memory extraction require real provider keys.
- The backend requests `delivery: "earbud"` semantically; actual audio route is controlled by the mobile app/OS.
- Interrupted `ask_on_stop` content does not yet have automatic expiry.

## Next Milestone

Build the mobile/iOS audio prototype with confirmed profile controls in the app, profile fact review/edit screens, and a research provider live path. After that, add WebRTC transport and evaluate NVIDIA Pipecat/Riva/PersonaPlex on an experimental provider branch.
