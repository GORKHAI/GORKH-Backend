# iOS Relay Test Setup

NearMind Relay testing needs backend credentials, but the iOS app must never store backend secrets. The iOS app stores only the pasted user JWT in Keychain.

## Required Backend Env

For local backend validation, configure:

- `DATABASE_URL`
- `JWT_SECRET`
- `REDIS_URL` or `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN` when using Upstash REST

Use existing Neon/Postgres and Upstash/Redis values from Render or Codespace only in an uncommitted local shell or `.env`.

Do not commit:

- `.env`
- JWTs
- database URLs
- Redis/Upstash tokens
- provider/API keys

## iOS App Requirements

- Install NearMind on simulator or iPhone.
- Paste a test JWT in Profile or Developer token entry.
- Confirm token status is stored.
- Open Profile -> Agent Requests.

The app does not send `userId` in Relay payloads. The backend derives the user from the JWT.

## Live Relay Verification

If production or staging test users are available:

```sh
export LIVE_API_URL='https://...'
export LIVE_TEST_JWT_A='...'
export LIVE_TEST_JWT_B='...'
export LIVE_RELAY_TEST_EMAIL_B='receiver@example.com'
npm run relay:live:verify
```

If the two live JWTs are missing, the verifier exits clearly with `missing_live_relay_test_credentials`. Do not fake live Relay success.

## Local Backend Validation

With DB and Redis env configured:

```sh
npm run check:infra
npm run db:push
npm run test:integration
npm run relay:replay:all
npm run mobile:replay:all
```

Missing `DATABASE_URL` or Redis/Upstash env is a backend setup blocker, not an iOS app failure.
