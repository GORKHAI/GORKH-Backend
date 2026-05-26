# Render + Neon + Upstash Deployment

GORKH deploys as three services:

- `gorkh-api`: API/control plane for auth, consent, sessions, brain, research, and queue APIs.
- `gorkh-voice-gateway`: media bridge for `/gateway/voice`.
- `gorkh-subagent-worker`: durable background worker for DB-backed subagent tasks.

## Required Environment

API:

- `DATABASE_URL`: Neon Postgres connection string.
- `JWT_SECRET`: shared HMAC secret.
- `HOST=0.0.0.0`
- `PORT`: Render-provided service port.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or `REDIS_URL`.

Gateway:

- `JWT_SECRET`: same as API.
- `GORKH_BACKEND_HTTP_URL`: public API URL.
- `GORKH_BACKEND_WS_URL`: public API websocket URL.
- `VOICE_GATEWAY_HOST=0.0.0.0`
- `VOICE_GATEWAY_PORT`: Render-provided service port.

Worker:

- `DATABASE_URL`
- `JWT_SECRET`
- `SUBAGENT_RUNNER_MODE=db_worker`
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or `REDIS_URL`.

Optional providers include DeepSeek, Deepgram, Voyage, and one research provider: Tavily, Brave, or Exa.

Do not paste provider keys into docs, logs, screenshots, `render.yaml`, or source code.

## Commands

Build:

```bash
npm ci --include=dev && npm run build
```

Start:

```bash
npm run api:start
npm run gateway:start
npm run worker:start
```

Migrate:

```bash
npm run db:push
```

Health and smoke:

```bash
npm run env:check
npm run deploy:check
npm run worker:health
npm run worker:metrics
npm run production:smoke
npm run production:privacy-smoke
```

## Worker Operations

```bash
npm run subagents:queue:inspect
npm run subagents:queue:reclaim-expired
npm run subagents:queue:cleanup-notifications
```

The worker handles SIGTERM/SIGINT. If a process dies mid-task, the task lease expires and can be reclaimed safely.

## Provider-Live Research

Recommended first provider is Tavily:

```bash
RESEARCH_PROVIDER=tavily
TAVILY_API_KEY=[secret]
```

Then run:

```bash
npm run research:live:all
npm run subagents:live-research:all
```

If no provider is configured, these commands exit with `provider_not_configured` and do not fabricate sources or citations.
