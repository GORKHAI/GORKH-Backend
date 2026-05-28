# Mobile Privacy Contract

Mobile must not record or stream audio before explicit consent. Disconnect/reconnect does not restart audio.

Profile mutation is gated:
- Casual chat defaults to `rememberMode=explicit_only` and `allowProfileMutation=false`.
- Explicit “remember that ...” requests may propose low-risk facts.
- Sensitive/stress facts still require opt-in and confirmation.
- Discarded or interrupted sessions never mutate profile, memory, skills, or reflections.

Session state:
- `GET /mobile/sessions/:id/state`
- `GET /sessions/:id/latency-summary`

Discarded sessions should show zero retained transcript/cue/output counts.
