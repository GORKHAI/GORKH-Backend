# Self-Improvement Policy

GORKH v0 improves through data structures and user-approved workflow changes, not model self-training.

Allowed:

- Session-end reflection after saved sessions.
- Proposed profile facts.
- Proposed skill candidates.
- Feedback records.
- Cue quality review.

Not allowed:

- Model weight training.
- Background autonomous actions.
- Auto-enabled skills.
- Reflection on discarded/interrupted sessions.
- Arbitrary code generation as an executable skill.
- Hidden memory writes.

All proposed skills remain disabled until approved.

Reflections are reviewable through `GET /brain/reflections`. Session-sourced profile facts and reflections are removed when a session is discarded or interrupted, even when transcript content is temporarily retained for recovery.
