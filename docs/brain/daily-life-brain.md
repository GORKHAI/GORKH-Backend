# Daily Life Brain v0

Daily Life Brain turns saved, consented interactions into reviewable daily planning artifacts:

- proposed commitments
- proposed task inbox items
- daily briefs
- follow-up drafts
- meeting prep and recap packs

It does not execute tasks, send messages, book appointments, submit forms, or read calendar/email data in v0.

## Safety Model

- Extracted commitments are proposed, not confirmed.
- Task inbox items are proposed until the user accepts them.
- Discarded and interrupted sessions are excluded from extraction.
- Medical, legal, and financial contexts can produce questions, follow-ups, and document requests, not final advice.
- Sensitive stress or psychological profile storage remains governed by the stress opt-in policy.

## User Flow

1. A session is saved.
2. The extractor scans persisted transcript text.
3. Explicit commitments are proposed.
4. Matching task inbox items are proposed.
5. Meeting recap and follow-up candidates may be created.
6. The user reviews, accepts, dismisses, or marks items done.
