# External Action Policy

GORKH v0 is proposal-first and approval-first.

## Hard Blocks

The backend must not:

- send emails or messages
- create, update, or cancel calendar events
- submit forms
- make purchases or payments
- use private browser sessions or cookies
- execute shell/code through tools
- invoke arbitrary MCP tools

## Allowed In v0

The backend may:

- draft message text for review
- propose calendar event details
- create internal task/reminder proposals
- execute safe internal actions after approval
- record approval and execution logs

## User Approval

Approval is explicit and persisted in `action_approvals`. Execution logs are persisted in `action_execution_logs`.

External connector execution returns `connector_not_configured` until a connector is implemented and approved by policy.
