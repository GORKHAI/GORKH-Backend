# Render Service Runbook

## API

Health:

- `GET /health`
- `GET /health/ready`

Operational checks:

- `GET /subagents/queue/metrics`
- `GET /brain/dashboard`
- `GET /research/providers`

## Voice Gateway

Health:

- `GET /health`
- `GET /providers`

Manual dev pages outside production:

- `/dev/live`
- `/dev/brain`

In production, these pages must remain disabled by policy. For staging or temporary protected validation, use:

- `/ops/live?token=<ops-admin-token>`
- `/ops/brain?token=<ops-admin-token>`

Disable `OPS_CONSOLE_ENABLED` again after testing if it was enabled on production.

## Worker

Render workers do not use HTTP health checks in this Blueprint. Validate with:

- worker logs
- `GET /subagents/queue/metrics`
- `GET /subagents/queue/failures`
- `npm run live:verify:worker`

If tasks remain queued past `LIVE_VERIFY_TIMEOUT_MS`, inspect worker logs and environment variables first.

## Logs

Check logs separately:

- API logs for HTTP/auth/db errors.
- Gateway logs for backend connection and ASR provider errors.
- Worker logs for queue claim, retries, provider errors, and graceful shutdown.

No logs should contain API keys, JWT secrets, database passwords, or Upstash tokens.
