# Investor Outreach v0

Investor Outreach v0 helps GORKH create reviewable investor outreach workflows without autonomous sending.

## Workflow

1. Create an outreach campaign from the startup summary, target stage, geography, sector, and raise target.
2. Run source-backed investor research through the configured research provider.
3. Store investor leads only when a public source exists.
4. Score fit using source-backed sector, stage, geography, and thesis signals.
5. Generate concise draft emails for review.
6. Create an action proposal for each draft.
7. Human approval is required before any further action.

## Boundaries

- GORKH does not send investor emails in v0.
- GORKH does not submit contact forms.
- GORKH does not use Gmail write/send scopes.
- GORKH does not invent investor names, partner names, email addresses, or fund thesis.
- Missing direct emails remain `null`.
- Scaled outbound campaigns require separate legal/compliance review.

