# Production Smoke Checklist

Run after deployment or before a release cut:

```bash
npm run env:check
npm run db:push
npm run service:check
npm run worker:health
npm run worker:metrics
npm run production:smoke
npm run production:privacy-smoke
npm run live:verify:prod-safety
```

Expected:

- API `/health/ready` reports DB and Redis reachable.
- Gateway `/health` reports backend reachable when gateway is configured/running.
- Worker metrics show queue counts and provider status without secrets.
- A safe subagent task can be queued and processed.
- Discarding a session removes transcript/cue/voice/subagent report content.

Manual checks:

- Confirm `/dev/brain` and `/dev/live` are disabled in production.
- Open protected `/ops/brain` or `/ops/live` only in staging or temporary protected ops mode.
- Browser microphone ASR requires a real browser and explicit consent.
