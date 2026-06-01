# Nearmind Rooms v0

Nearmind Rooms v0 adds a backend-controlled investor video-call workflow around LiveKit room/token architecture.

## Scope

- Host creates a room from an outreach investor or manually.
- Backend stores the room, participants, consent state, transcript segments, summaries, and audit events.
- Backend can mint least-privilege host/guest LiveKit tokens only when LiveKit is configured.
- Guest invite tokens are opaque and stored only as hashes.
- AI is observer-only by default and does not speak to guests.
- Post-call summaries can create draft-only follow-up action proposals.

## Non-goals

- No iOS/Android app in this milestone.
- No Google Meet creation.
- No email sending.
- No calendar writes.
- No recording endpoint.
- No transcription before consent.
- No hidden AI participant.

If `ROOMS_ENABLED=false`, LiveKit token operations return `rooms_disabled`. If LiveKit env is missing, real token operations return `rooms_not_configured`. Room review records may still be created for control-plane testing.
