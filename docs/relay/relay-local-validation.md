# NearMind Relay Local Validation

NearMind Relay backend validation requires real local service configuration. Do not treat missing local env as a Relay product failure.

## Required Local Environment

Set these values in your shell or an uncommitted local `.env`:

- `DATABASE_URL`
- `JWT_SECRET`
- `REDIS_URL` or `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN` when using Upstash REST

Optional live validation values:

- `LIVE_API_URL`
- `LIVE_GATEWAY_URL`
- `LIVE_TEST_JWT_A`
- `LIVE_TEST_JWT_B`
- `LIVE_RELAY_TEST_EMAIL_B` or `LIVE_TEST_EMAIL_B`

Never commit `.env`, JWTs, database URLs, Redis tokens, provider keys, or API secrets.

## Getting Existing Render/Codespace Env Locally

Use the same Neon/Postgres and Upstash/Redis values configured for the deployed backend, but paste them only into a local shell session or untracked `.env`.

Recommended local shell pattern:

```sh
export DATABASE_URL='postgres://...'
export JWT_SECRET='...'
export UPSTASH_REDIS_REST_URL='https://...'
export UPSTASH_REDIS_REST_TOKEN='...'
```

If your environment uses direct Redis:

```sh
export REDIS_URL='redis://localhost:6379'
```

## Local Validation Commands

Run:

```sh
npm run env:check
npm run check:infra
npm run db:push
npm run test:integration
npm run relay:replay:all
npm run mobile:replay:all
npm run brain:replay:all
npm run actions:replay:all
npm run outreach:replay:all
npm run rooms:replay:all
npm run security:no-secret-scan
```

Expected:

- Relay migrations apply idempotently.
- Relay request lifecycle works across two test users.
- Mobile sync includes Relay items.
- No email or external action is sent.
- No private memory, calendar, email, or profile data is shared automatically.

## Live Relay Verification

For production or staging, prefer two explicit test JWTs:

```sh
export LIVE_API_URL='https://...'
export LIVE_TEST_JWT_A='...'
export LIVE_TEST_JWT_B='...'
export LIVE_RELAY_TEST_EMAIL_B='receiver@example.com'
npm run relay:live:verify
```

The verifier does not print JWTs. It exits with `missing_live_relay_test_credentials` if required live credentials are missing.

Only in a non-production environment where `/dev/users` is intentionally enabled:

```sh
export LIVE_API_URL='https://...'
export LIVE_RELAY_USE_DEV_USERS=true
npm run relay:live:verify
```

The live verifier creates separate request scenarios for approve, reject, and block. The block scenario is intentionally destructive for those test users, so use disposable Relay test accounts.
