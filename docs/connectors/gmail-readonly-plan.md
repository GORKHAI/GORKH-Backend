# Gmail Read-Only Plan

First supported scope:
- `https://www.googleapis.com/auth/gmail.metadata`

Possible later reviewed scope:
- `https://www.googleapis.com/auth/gmail.readonly`

Allowed in v0 readiness:
- Show least-privilege scope registry.
- Record consent events.
- Import fixture/manual email items for tests.
- Create draft follow-up action proposals inside GORKH.

Disabled:
- Sending email.
- Creating Gmail drafts through Google APIs.
- Modifying labels.
- Deleting email.
- Reading email bodies without explicit future review.
