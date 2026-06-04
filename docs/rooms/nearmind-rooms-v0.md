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

## Staging Room Join v1

The v1 staging browser client bundles `livekit-client` and is served by the voice gateway:

- Host: `/rooms/ui/:roomId`
- Guest: `/r/:inviteToken`

The browser joins only after an explicit Join click and browser permission grant. It attaches local/remote media tracks, logs participant and track events, and stops local tracks on leave/disconnect/page unload. Browser media success is never claimed by scripts; run `npm run rooms:live:browser-checklist` and verify host/guest audio/video manually.
