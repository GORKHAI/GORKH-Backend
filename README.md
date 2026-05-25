# realhand-engine

The real-time situational copilot engine — the spine every mode (Meeting, Bank,
Negotiation, Personal) reuses:

```
audio/text → streaming ASR → rolling context buffer → trigger classifier
           → [priority gate + cooldown] → memory retrieval → suggestion card → client
           → (on stop) memory extraction → durable cross-session memory
```

The engine is provider-real: Deepgram for streaming speech-to-text, Anthropic for
in-session suggestions and post-session memory extraction, Voyage for embeddings,
Postgres+pgvector for durable memory, Redis for live session state. There are no
placeholder integrations — missing credentials produce clear typed errors, never
fake results.

## Architecture / file map

```
src/
  config.ts                 env loading + zod validation; requireKey() guard
  server.ts                 Fastify app: /health, POST /users, ws /session
  redis.ts                  rolling buffer + atomic suggestion cooldown
  db/
    schema.ts               drizzle schema (users, sessions, transcript_segments,
                            memories[pgvector], suggestions)
    client.ts               pg pool + drizzle (local & Neon compatible)
  asr/
    deepgram.ts             real Deepgram v3 live streaming, diarized
  trigger/
    classifier.ts           deterministic, no-LLM detection of suggestion-worthy
                            moments (financial terms, amounts, questions,
                            commitments, decisions, known subjects)
  memory/
    embeddings.ts           Voyage embeddings (REST)
    store.ts                insert + cosine (pgvector) retrieval, known subjects
    extract.ts              post-session memory extraction via Anthropic
  suggest/
    prompts.ts              mode-specific system prompts
    engine.ts               Anthropic Messages call -> glanceable suggestion card
  session/
    manager.ts              orchestration; ingestFinalSegment() is the convergence
                            point for both audio and text paths
  ws/
    handler.ts              websocket protocol; per-connection serial message queue
  scripts/
    migrate.ts              idempotent DDL + pgvector HNSW index
    fixtures.ts             scripted bank/meeting transcripts
    replay.ts               ws client that drives the engine with a script (no mic)
    memory-integration.ts   pgvector insert+search test (fixture vectors, no key)
    session-integration.ts  full session loop test against real PG+Redis (no key)
  test/
    trigger.test.ts         vitest unit tests for the classifier
```

## Prerequisites

- Node 20+ (developed on Node 22)
- Postgres 16 with the `vector` (pgvector) extension available
- Redis 7

## Setup

```bash
npm install
cp .env.example .env        # fill in keys as needed (see below)
npm run db:push             # create tables + pgvector index (idempotent)
```

Local infra quickstart (Debian/Ubuntu):

```bash
apt-get install -y postgresql postgresql-contrib postgresql-16-pgvector redis-server
# create role/db:
psql -c "CREATE USER realhand WITH PASSWORD 'realhand' SUPERUSER;"
psql -c "CREATE DATABASE realhand OWNER realhand;"
psql -d realhand -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Environment keys

`DATABASE_URL` and `REDIS_URL` are required to boot. Provider keys are optional at
boot and validated at call time:

| Key | Powers | Get it at |
|-----|--------|-----------|
| `ANTHROPIC_API_KEY` | suggestion cards + memory extraction | console.anthropic.com |
| `DEEPGRAM_API_KEY`  | live audio transcription (Meeting Mode) | console.deepgram.com |
| `VOYAGE_API_KEY`    | memory embeddings | dashboard.voyageai.com |

Without a given key, the dependent step emits a clear error event
(`{"type":"error","stage":"suggestion","message":"Anthropic ... not configured"}`)
instead of fabricating output.

## Run

```bash
npm run dev          # server with watch
npm run start        # server once
npm run replay -- bank      # drive the engine with the bank transcript (no mic)
npm run replay -- meeting   # meeting transcript
```

## WebSocket protocol (`ws://HOST:PORT/session`)

Client → server (JSON):

```jsonc
{ "type":"start", "userId":"<uuid>", "mode":"meeting|bank|negotiation|personal",
  "consent":true, "title":"...", "source":"text|audio", "selfSpeakerIndex":0 }
{ "type":"transcript", "speaker":"me|speaker_0", "text":"...", "offsetMs":0 }  // text source
{ "type":"stop", "save":true }
```
When `source:"audio"`, send raw PCM16 (16 kHz mono) as **binary** frames instead of
`transcript` messages; they are forwarded to Deepgram.

Server → client (JSON): `ack`, `segment`, `triggers`, `suggestion`, `summary`, `error`.

A `stop` with `save:true` runs memory extraction; `save:false` discards and
hard-deletes the transcript (privacy-first).

---

## Done checklist — verified commands & expected output

All of the following were run against real local Postgres+pgvector and Redis.

1. **Typecheck**
   ```bash
   npm run typecheck
   ```
   Expected: no output, exit 0.

2. **Trigger classifier unit tests**
   ```bash
   npm run test:trigger
   ```
   Expected: `Tests  10 passed (10)`.

3. **Migration**
   ```bash
   npm run db:push
   ```
   Expected: `migration: schema is up to date`.

4. **Memory retrieval (pgvector, no key)**
   ```bash
   npm run test:memory
   ```
   Expected: `MEMORY INTEGRATION: PASS (nearest-vector retrieval ranks the matching memory first)`.

5. **Full session loop (real PG+Redis, no key)**
   ```bash
   npm run test:session
   ```
   Expected:
   ```
   segments persisted: 7 / 7
   rolling buffer size: 7
   financial-term triggers detected: 5
   suggestion-stage errors (expected without ANTHROPIC_API_KEY): 1
   SESSION INTEGRATION: PASS
   ```

6. **Health check**
   ```bash
   npm run start &        # then:
   curl -s localhost:8787/health
   ```
   Expected:
   ```json
   {"ok":true,"redis":true,"db":true,"providers":{"anthropic":false,"deepgram":false,"voyage":false}}
   ```

7. **End-to-end WebSocket replay**
   ```bash
   npm run replay -- bank
   ```
   Expected: the full transcript prints in order (first line included), trigger
   lines fire (`money_or_percent`, `financial_term`), session saves. With no
   `ANTHROPIC_API_KEY` the suggestion lines are `⚠ error[suggestion]: ... not
   configured`; **add the key and re-run to see real `💡 [caution] ...` cards.**

### What cannot run in a keyless environment (and why)

| Step | Needs | How to verify once keyed |
|------|-------|--------------------------|
| Suggestion cards | `ANTHROPIC_API_KEY` | `npm run replay -- bank` → `💡` lines |
| Memory extraction on save | `ANTHROPIC_API_KEY` | replay with `save:true` → `memories stored: N>0` |
| Live audio transcription | `DEEPGRAM_API_KEY` + PCM audio source | send `source:"audio"` + binary frames |
| Memory embeddings (production path) | `VOYAGE_API_KEY` | `storeMemories()`/`searchMemories()` |

The integration points are real (documented endpoints, correct request/response
shapes); only execution is gated on the secrets above.

## Next slice

Mobile capture layer (React Native dev build): mic → PCM16 → binary frames to
`source:"audio"`, the consent gate + always-visible recording indicator, and the
glanceable suggestion-card UI consuming the `suggestion` events.
