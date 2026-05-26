# Subagent Worker Runbook

## Commands

- `npm run subagents:worker`: run the durable worker loop.
- `npm run subagents:worker:once`: claim one due batch and exit.
- `npm run subagents:queue:inspect`: print safe queue counts and oldest timestamps.
- `npm run subagents:queue:reclaim-expired`: release expired task leases.
- `npm run subagents:queue:cleanup-notifications`: remove old notification rows.
- `npm run worker:start`: production worker entrypoint.
- `npm run worker:health`: command health check.
- `npm run worker:metrics`: safe queue and worker metrics.

## Lease Model

Workers claim queued tasks using Postgres row locking and set `lockedBy`, `leaseToken`, `lockedAt`, and `lockedUntil`. Heartbeats extend `lockedUntil`. If a worker dies, `subagents:queue:reclaim-expired` or another worker can reclaim the row after the lease expires.

## Retry Model

Transient thrown errors retry with bounded exponential backoff. Policy denial, provider-not-configured, cancellation, and privacy suppression are non-retryable.

## Operational Rules

Do not print provider keys. Do not log task payloads in worker status output. Queue inspection is limited to counts and timestamps.

## Deployment Shutdown

The production worker handles SIGTERM/SIGINT and exits cleanly. If shutdown happens while a task is running, the lease expires and another worker can reclaim it after `SUBAGENT_TASK_LEASE_MS`.
