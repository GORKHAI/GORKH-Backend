# Render Post-Deploy Verification

Set live URLs locally:

```bash
export LIVE_API_URL=https://<api>.onrender.com
export LIVE_GATEWAY_URL=https://<gateway>.onrender.com
export LIVE_API_WS_URL=wss://<api>.onrender.com
export LIVE_GATEWAY_WS_URL=wss://<gateway>.onrender.com
```

If `/dev/users` is disabled in production, also set:

```bash
export LIVE_TEST_JWT=<smoke-user-jwt>
```

Then run:

```bash
npm run render:postdeploy
npm run live:verify
npm run live:verify:prod-safety
```

Expected summary fields:

- API live
- Gateway live
- Worker processing
- Brain dashboard
- Voice text session
- Subagent queue
- Research provider
- Actions approval
- Privacy discard
- Dev pages
- Browser mic manual test
- Overall status

Provider-live research can only pass with real source-backed results if `RESEARCH_PROVIDER` and the matching provider key are configured. Otherwise the correct passing behavior is `provider_not_configured` with no fake citations.

Production `/dev/live` and `/dev/brain` must return 404 or disabled. Browser microphone ASR cannot be claimed from scripts. It must be tested manually from protected `/ops/live` on staging, or from a temporary protected production ops console that is disabled again after testing.

Protected ops console variables:

```bash
OPS_CONSOLE_ENABLED=true
OPS_CONSOLE_ADMIN_TOKEN=[secret]
OPS_CONSOLE_ALLOW_TEST_USER=true
OPS_CONSOLE_ALLOWED_ORIGINS=https://voice.gorkh.com
OPS_CONSOLE_SESSION_TTL_SECONDS=3600
```

Do not print the admin token in logs or screenshots. Prefer staging for this flow.
