# Future A2A Compatibility

NearMind Relay v0 is intentionally closed and controlled. It is not open federation and does not implement external A2A or arbitrary MCP.

The current schema keeps future compatibility by storing:

- Sender and recipient identities.
- Request type.
- Safe text summary.
- Explicit requested share fields.
- Human decisions.
- Auditable messages.
- Block state.

Future A2A work should preserve these invariants:

- Human approval remains mandatory for sensitive sharing.
- Sender identity is derived from auth, not client-provided `userId`.
- Private memory and profile data are never exposed automatically.
- External delivery channels require explicit product policy, consent, and audit.
- Remote agents must be allowlisted, authenticated, and rate-limited.
- Receivers must be able to block, ignore, or reject.

Open federation, public discovery, and unrestricted tool invocation are out of scope until a separate threat model and interoperability policy exist.
