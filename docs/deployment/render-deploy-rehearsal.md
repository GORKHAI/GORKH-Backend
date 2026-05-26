# Render Deploy Rehearsal

This runbook rehearses deployment of three independent services:

- API/control plane: `gorkh-api`
- Voice Gateway: `gorkh-voice-gateway`
- Durable Subagent Worker: `gorkh-subagent-worker`

## Preflight

Run locally:

```bash
npm install
npm run typecheck
npm test
npm run build
npm run db:push
npm run deploy:check
npm run render:preflight
npm run security:no-secret-scan
```

`render:preflight` verifies the Blueprint, build artifacts, deployment docs, local production smoke, privacy smoke, and secret scan.

## Blueprint Setup

1. Push the repository to GitHub.
2. In Render, create a new Blueprint from the repository.
3. Confirm exactly three services are created:
   - `gorkh-api`
   - `gorkh-voice-gateway`
   - `gorkh-subagent-worker`
4. Fill secrets through the Render dashboard only.
5. Do not edit `render.yaml` with real secrets.

## Service Wiring

Set the deployed API URL into the gateway:

- `GORKH_BACKEND_HTTP_URL=https://<api>.onrender.com`
- `GORKH_BACKEND_WS_URL=wss://<api>.onrender.com`

The worker does not expose a public web health endpoint. Verify it through logs and API queue metrics.

## Migration

Run the migration once after the API environment is configured:

```bash
npm run db:push
```

On Render this can be run from a one-off shell/job if available, or locally with the production `DATABASE_URL`.

## Deploy Order

1. Deploy API.
2. Confirm `/health/ready`.
3. Deploy Voice Gateway.
4. Confirm `/health`.
5. Deploy Worker.
6. Confirm worker logs show polling/processing.
7. Run `npm run render:postdeploy` from Codespaces with live URLs set.

## Rollback

If API readiness fails, roll back API first. If the gateway fails, leave API running and roll back gateway. If worker fails, stop or roll back only the worker; queued tasks remain DB-backed and can be processed after the worker is healthy.
