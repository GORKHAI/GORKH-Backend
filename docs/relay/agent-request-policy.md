# Agent Request Policy

NearMind Relay v0 follows these policy rules:

- The sender is always derived from the JWT.
- iOS and other clients must not send `userId`.
- A request targets one trusted contact, known NearMind user, or staged email contact.
- No mass broadcast is available in v0.
- Team update requests are draft-only for future company workspace support.
- No public discovery or public profile lookup is available.
- No private memory, calendar, email, Gmail, profile, access token, provider key, or secret is shared automatically.
- Requested share fields must be explicit and limited.
- High-risk and medium-risk requests require sender approval before sending.
- Receivers approve, reject, ignore, or block before any receiver-controlled payload is shared.
- Email-only recipients do not receive external email in v0.
- Document/deck sharing is not implemented in v0.
- All draft, send, decision, block, and message actions are audited.

Policy failures return safe error envelopes and do not expose private data.
