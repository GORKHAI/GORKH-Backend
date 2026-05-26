# Skill Learning Policy

A skill is a reusable workflow template, not arbitrary executable code.

Allowed skill shape:

- Name.
- Description.
- Trigger pattern.
- Ordered steps.
- Risk level.
- Status.

Statuses:

- `proposed`
- `approved`
- `enabled`
- `disabled`
- `rejected`

Approval:

- Learned skills start as `proposed`.
- User approval is required before enabling.
- Adaptive Brain v0 never auto-enables skills.

Rejected skill capabilities:

- Shell execution.
- Form submission.
- Login browser access.
- Payment or purchase.
- Sending messages.
- Medical diagnosis.
- Manipulation.
- Unsafe financial/legal/medical decisions.

`POST /skills/match` returns enabled matching skills only. Skill manifests are validated against dangerous steps including shell execution, form submission, login browser access, payment, hidden recording, unapproved messaging, medical diagnosis, manipulation, and final legal/financial decisions.

Brain Console exposes the local approval workflow: inspect proposed skills, approve them, enable them, disable them, and match enabled skills for a situation. The console is not allowed to create executable code skills.
