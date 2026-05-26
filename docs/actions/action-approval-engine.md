# Action Approval Engine v0

The action approval engine turns user intent into explicit, reviewable proposals. It does not grant autonomous external power.

## Proposal Lifecycle

1. `proposed` - created by voice, brain, daily life, manual API, or subagent flow.
2. `approved` - user explicitly approved the proposal.
3. `rejected` - user rejected the proposal.
4. `executed` - a safe internal action completed after approval.
5. `failed` - execution failed or was blocked.
6. `expired` - proposal is no longer valid.

## Supported Proposal Types

- `draft_email`
- `propose_calendar_event`
- `propose_reminder`
- `draft_followup_message`
- `create_task_from_commitment`
- `research_watchlist_create`
- `profile_fact_confirm`
- `skill_enable`

## Execution Boundary

Safe internal actions can execute after approval:

- internal reminder/task creation
- accepting an existing task from a commitment
- internal research watchlist task creation
- profile fact confirmation
- skill enablement

External connector actions are blocked in v0:

- sending email/messages
- creating/canceling meetings
- submitting forms
- payments/purchases
- browser login/session access

Drafts remain local proposals. GORKH does not send them.
