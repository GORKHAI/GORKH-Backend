# NearMind Auth v0

NearMind Auth v0 adds account readiness without enabling a production login provider by default.

## Configuration

```text
AUTH_ENABLED=true
APPLE_SIGN_IN_ENABLED=false
APPLE_BUNDLE_ID=ai.nearmind.app
APPLE_ALLOWED_AUDIENCES=ai.nearmind.app,ai.nearmind.gorkh.dev
EMAIL_AUTH_ENABLED=false
EMAIL_AUTH_PROVIDER=none
AUTH_JWT_TTL_SECONDS=2592000
AUTH_REFRESH_ENABLED=false
ACCOUNT_DELETION_ENABLED=true
ACCOUNT_DELETION_MODE=request
PLAN_DEFAULT=internal_alpha
BILLING_ENABLED=false
```

Apple and email auth env is optional while disabled. The API boots without Apple keys or email provider credentials.

## Endpoints

- `POST /auth/apple/verify`
- `POST /auth/email/start`
- `POST /auth/email/verify`
- `GET /account/me`
- `POST /account/sign-out`
- `POST /account/delete-request`
- `POST /account/delete-cancel`
- `GET /plans/me`
- `GET /billing/status`

All account endpoints derive identity from the verified JWT. Clients do not send `userId`.

## Current Behavior

- Apple Sign In returns `apple_sign_in_not_enabled` unless explicitly enabled.
- Email auth returns `email_auth_not_enabled` or `email_provider_not_configured`; no email is sent in v0.
- Account deletion creates a request record and audit event. It does not immediately delete the account.
- Plan status defaults to `internal_alpha`.
- Billing status is read-only and disabled. There is no StoreKit, pricing, paywall, or external payment link.

## Security

JWTs are not printed by auth replays or returned from account profile endpoints. Apple identity tokens are verified server-side only when Apple Sign In is enabled and are never returned to clients.
