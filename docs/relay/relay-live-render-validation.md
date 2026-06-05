# NearMind Relay Live Render Validation

This checklist validates NearMind Relay against the deployed Render services. It is a private, human-approved agent request flow, not a public network and not external A2A federation.

## Render Services

- API: `gorkh-api`
  - Service ID: `srv-d8au88ojo6nc7383qf40`
  - Public URL: `https://api.gorkh.com`
  - Render internal address: `gorkh-api:3000`
- Voice Gateway: `gorkh-voice-gateway`
  - Service ID: `srv-d8auduvavr4c73dtu9vg`
  - Public URL: `https://voice.gorkh.com`
  - Render internal address: `gorkh-voice-gateway:10000`
- Worker: `gorkh-subagent-worker`
  - Service ID: `srv-d8aua4ojs32c73buve70`
  - Background worker, not publicly reachable

From a local Mac or Codespace, use only public URLs. Do not use Render internal addresses in local verification scripts.

## Required Env

```sh
export LIVE_API_URL='https://api.gorkh.com'
export LIVE_GATEWAY_URL='https://voice.gorkh.com'
export LIVE_API_WS_URL='wss://api.gorkh.com'
export LIVE_GATEWAY_WS_URL='wss://voice.gorkh.com'
export RENDER_API_SERVICE_ID='srv-d8au88ojo6nc7383qf40'
export RENDER_GATEWAY_SERVICE_ID='srv-d8auduvavr4c73dtu9vg'
export RENDER_WORKER_SERVICE_ID='srv-d8aua4ojs32c73buve70'
```

Use one credential method.

Preferred, two explicit test JWTs:

```sh
export LIVE_TEST_JWT_A='...'
export LIVE_TEST_JWT_B='...'
export LIVE_RELAY_TEST_EMAIL_B='receiver@example.com'
export LIVE_RELAY_TEST_DISPLAY_NAME_A='Relay Sender'
export LIVE_RELAY_TEST_DISPLAY_NAME_B='Relay Receiver'
```

Temporary ops test-user flow:

```sh
export OPS_CONSOLE_ADMIN_TOKEN='...'
export LIVE_RELAY_TEST_EMAIL_A='relay-sender@example.com'
export LIVE_RELAY_TEST_EMAIL_B='relay-receiver@example.com'
```

If `LIVE_TEST_JWT_A` and `LIVE_TEST_JWT_B` are present, the verifier uses them. If they are missing and `OPS_CONSOLE_ADMIN_TOKEN` is present, it calls protected `/ops/test-user`. If neither is available, it exits with `missing_live_relay_test_credentials`.

Never print, commit, or paste JWTs or `OPS_CONSOLE_ADMIN_TOKEN` into issue text or logs.

## Command

```sh
LIVE_API_URL=https://api.gorkh.com \
LIVE_GATEWAY_URL=https://voice.gorkh.com \
LIVE_API_WS_URL=wss://api.gorkh.com \
LIVE_GATEWAY_WS_URL=wss://voice.gorkh.com \
npm run relay:live:verify
```

## What Success Looks Like

The final JSON summary should report:

- `apiLive=true`
- `gatewayLive=true`
- `userAIdentity=true`
- `userBIdentity=true`
- `contactCreated=true`
- `requestDrafted=true`
- `senderApproved=true`
- `receiverInbox=true`
- `receiverApproved=true`
- `receiverRejected=true`
- `receiverIgnored=true`
- `receiverBlocked=true`
- `blockPreventsFollowUp=true`
- `mobileSync=true`
- `auditEvents=true`
- `status=passed`

These must remain false:

- `externalSendExecuted`
- `privacyLeakDetected`
- `rawTokenPrinted`

The verifier checks API `/health`, API `/health/ready`, gateway `/health`, gateway `/providers`, Relay request lifecycle, mobile sync item types, audit events, and block enforcement. It does not run microphone validation.

## Safety Notes

- No email is sent.
- No Gmail or Calendar write action is executed.
- No private memory, profile, calendar, or email data is shared automatically.
- Receiver approval shares only the explicit approved payload.
- Block testing is intentionally stateful. Use disposable users or ops-minted test users for repeat runs.

## Disable Ops Test User After Test

If the temporary ops flow was enabled, disable it after verification:

- turn off `OPS_CONSOLE_ALLOW_TEST_USER`
- remove or rotate `OPS_CONSOLE_ADMIN_TOKEN` if it was created only for smoke testing
- redeploy `gorkh-api`
- rerun production safety checks

