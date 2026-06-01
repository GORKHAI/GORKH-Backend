# Post-Session Longform ASR Plan

This is a design-only plan. GORKH does not store or process raw audio for this milestone.

## Preconditions

- Session status is `saved`.
- User explicitly consented to raw audio retention.
- User explicitly consented to post-session audio analysis.
- Retention policy allows raw audio processing.
- The session was not discarded or interrupted.

## Blocked Cases

- Discarded session.
- Interrupted session.
- Missing explicit audio-analysis consent.
- Raw audio unavailable.
- Retention policy disallows raw audio.

## Future Processing Stages

1. Load saved audio reference.
2. Run optional VibeVoice-ASR lab.
3. Produce speaker/timestamp transcript segments.
4. Extract commitments and tasks.
5. Generate meeting recap.
6. Identify risk flags.
7. Detect source-backed research requests.
8. Store derived outputs only under the session retention policy.

## Privacy Rules

- Do not process discarded/interrupted audio.
- Do not store sensitive psychological/stress facts without opt-in and confirmation.
- Do not use audio to infer emotions or truthfulness.
- Do not run speaker identity matching or voice biometrics.

## Current Status

Implemented as `buildPostSessionAudioAnalysisPlan(...)` only. No model execution or raw-audio storage is present.
