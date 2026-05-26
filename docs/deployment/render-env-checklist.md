# Render Environment Checklist

Use this checklist before creating the Render Blueprint. Do not paste real secrets into `render.yaml`, docs, screenshots, or issue comments.

## API Service: `gorkh-api`

Required:

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `PORT` from Render, or `10000`
- `DATABASE_URL` from Neon
- `JWT_SECRET`
- `LLM_PROVIDER=deepseek` or `none`
- `DEEPSEEK_BASE_URL=https://api.deepseek.com`
- `DEEPSEEK_CHAT_MODEL=deepseek-v4-flash`
- `DEEPSEEK_API_KEY` if DeepSeek is enabled
- `RESEARCH_PROVIDER=none`, `tavily`, `brave`, or `exa`
- Matching research key only if a research provider is selected
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or `REDIS_URL`

Optional protected ops console:

- `OPS_CONSOLE_ENABLED=false` by default
- `OPS_CONSOLE_ADMIN_TOKEN` only when protected ops console is intentionally enabled
- `OPS_CONSOLE_ALLOW_TEST_USER=true` only for staging/smoke validation
- `OPS_CONSOLE_ALLOWED_ORIGINS=https://voice.gorkh.com` or staging gateway origin

## Voice Gateway: `gorkh-voice-gateway`

Required:

- `NODE_ENV=production`
- `VOICE_GATEWAY_HOST=0.0.0.0`
- `VOICE_GATEWAY_PORT` from Render, or `10000`
- `JWT_SECRET`, same value as API
- `GORKH_BACKEND_HTTP_URL=<deployed API URL>`
- `GORKH_BACKEND_WS_URL=<deployed API WS URL>`
- `VOICE_GATEWAY_ASR_PROVIDER=deepgram`
- `DEEPGRAM_API_KEY`
- `DEEPGRAM_MODEL=nova-3`
- `VOICE_GATEWAY_OUTPUT_STRATEGY=client_tts`

Optional protected ops console:

- `OPS_CONSOLE_ENABLED=false` by default
- `OPS_CONSOLE_ADMIN_TOKEN`, same ops admin token used for protected browser console access
- `OPS_CONSOLE_SESSION_TTL_SECONDS=3600`

## Worker: `gorkh-subagent-worker`

Required:

- `NODE_ENV=production`
- `DATABASE_URL`
- `JWT_SECRET`
- `SUBAGENT_RUNNER_MODE=db_worker`
- `LLM_PROVIDER`
- `DEEPSEEK_API_KEY` if DeepSeek is enabled
- `RESEARCH_PROVIDER` and matching key if provider-live research is enabled
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or `REDIS_URL`

## Live Verification Variables

Set these locally in Codespaces after deploy, not in `render.yaml`:

- `LIVE_API_URL`
- `LIVE_GATEWAY_URL`
- `LIVE_API_WS_URL`
- `LIVE_GATEWAY_WS_URL`
- `LIVE_TEST_JWT` if `/dev/users` is disabled in production
- `LIVE_TEST_EMAIL`
- `LIVE_TEST_DISPLAY_NAME`
- `LIVE_VERIFY_TIMEOUT_MS`
