# Privacy And Approval Model

Relay separates proposing from executing.

## Sender Approval

The sender's agent can draft a request, but the sender must approve before a request moves to `sent`. Approval does not trigger email or external messaging in v0.

## Receiver Approval

The receiver decides what to share. Approving a request shares only the `approvedPayload` supplied during the decision. NearMind does not automatically attach private memory, profile, calendar, email, documents, rooms, or deck files.

## Blocking

Receivers can block senders. Blocked senders are rejected by policy for future requests to that recipient.

## Audit

Relay writes audit events for identity creation, contact creation, request draft, send, cancel, approve, reject, ignore, block, and message actions.

## Mobile Sync

`GET /mobile/sync?cursor=` includes Relay event types:

- `relay_request_received`
- `relay_request_updated`
- `relay_request_message`
- `relay_approval_needed`

Mobile sync payloads do not contain secrets or raw private context for recipients.
