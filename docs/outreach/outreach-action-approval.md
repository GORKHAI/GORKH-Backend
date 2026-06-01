# Outreach Action Approval

Outreach drafts become action proposals using `outbound_email_review`.

## v0 Behavior

- Proposals are review-only.
- Approval records human review state.
- Execution through external connectors is blocked.
- Email sending remains disabled even after approval.

## Execution Result

Attempting to execute an external outreach proposal returns a disabled or not-configured connector result. This is intentional until a future write-approved connector milestone implements explicit sending controls.

