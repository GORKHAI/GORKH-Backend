# Brain Console v0 Manual Test Checklist

Brain Console is served by the Voice Gateway at `/dev/brain` outside production only.

## Setup

1. Start the backend.
2. Start the voice gateway.
3. Open the forwarded gateway URL at `/dev/brain`.
4. Click **Create Dev User** or paste a JWT.
5. Click **Refresh All**.

## Profile Review

1. Run a brain query such as `I am a blockchain developer and I build mobile apps.`
2. Open **Profile Review**.
3. Confirm low-risk proposed facts.
4. Reject a proposed fact.
5. Confirm sensitive candidates are not auto-confirmed.

## Stress Settings

1. Open **Stress**.
2. Load settings and confirm France `3114` and US `988` resources are visible.
3. Opt in, request support for `I'm stressed before this meeting.`, then opt out.
4. Verify the response is support only and does not claim therapy, diagnosis, treatment, or emergency-service status.

## Skills

1. Generate or replay a skill proposal.
2. Open **Skills**.
3. Approve, enable, then disable a skill.
4. Run **Match Bank Skill** and confirm only enabled skills are returned.

## Research

1. Open **Research**.
2. Load provider status.
3. With `RESEARCH_PROVIDER=none`, run a research query and confirm `provider_not_configured`.
4. With a provider key configured, run `official APR explanation consumer loan`.
5. Confirm returned citations/sources are real URLs from provider results.

## Tools and Audit

1. Load tool permissions.
2. Confirm dangerous capabilities are disabled: `execute_code`, `submit_form`, browser login/session access, payment, hidden recording, and unapproved external messaging.
3. Load audit events and confirm no secrets or provider keys are displayed.

## Session Privacy

1. Paste a session ID.
2. Load session counts.
3. For discarded sessions, confirm retained transcript/cue/output counts are zero.

## /dev/live Link

Use the `/dev/live` link for microphone validation. Brain Console does not claim live microphone transcription.
