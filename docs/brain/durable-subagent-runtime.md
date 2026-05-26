# Durable Subagent Runtime

GORKH subagents are now DB-backed tasks that can be claimed by a Postgres worker. The API process enqueues tasks; a worker claims queued rows, takes a lease, heartbeats while executing, writes attempts/events/reports, and releases or retries the task.

## Queue Lifecycle

- `queued`: task is ready when `nextRunAt` is null or in the past.
- `running`: worker owns the task through `lockedBy`, `leaseToken`, and `lockedUntil`.
- `completed`: report was produced and persisted.
- `failed`: non-retryable or exhausted failure. Provider-not-configured is non-retryable.
- `canceled`: user or session lifecycle canceled the task.
- `expired`: task timed out.
- `suppressed`: privacy/session policy prevents report delivery.

## Worker Modes

- `db_worker`: preferred durable mode. Workers claim from Postgres.
- `in_process`: compatibility/dev mode using the same DB claim path.
- `disabled`: enqueue only; no worker executes tasks.

The server can run an embedded DB worker loop in dev, and `npm run subagents:worker` can run a separate long-running worker.

## Production Service Split

- API service: `npm run api:start`
- Voice Gateway service: `npm run gateway:start`
- Durable worker service: `npm run worker:start`

The API enqueues tasks. The worker claims queued tasks with leases and heartbeats. The gateway only forwards voice events; it does not execute subagents.

## Observability

Use:

```bash
npm run worker:health
npm run worker:metrics
```

Authenticated API routes:

- `GET /subagents/queue/metrics`
- `GET /subagents/queue/failures`
- `GET /subagents/notifications`
- `GET /subagents/stream`

Metrics include queue counts, retry counts, running locks, recent failures, provider status, and notification counts. They do not include secrets or raw provider keys.

## No Fake Outputs

Research subagents never fabricate sources or citations. If `RESEARCH_PROVIDER=none` or the selected provider key is missing, the report records `provider_not_configured` and contains no citations.
