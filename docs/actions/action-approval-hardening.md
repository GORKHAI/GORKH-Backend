# Action Approval Hardening

Action proposals are review objects, not autonomous execution permissions.

Current rules:
- External writes are blocked.
- Email send is disabled.
- Calendar create/update/delete is disabled.
- Internal safe actions require approval before execution.
- `/actions/proposals/:id/preview` explains risk, approvals, connector state, and blocked reasons.

Future connector writes must add a second explicit approval layer and provider-specific execution audit logs before any real external mutation is allowed.
