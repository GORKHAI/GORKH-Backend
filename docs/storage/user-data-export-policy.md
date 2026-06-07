# User Data Export Policy

User exports include account/profile metadata, memory summaries, sessions metadata, daily tasks, commitments, Relay requests, action proposals, outreach campaigns, rooms metadata/summaries, connector account metadata without tokens, and a storage object manifest.

Exports exclude:

- JWTs
- OAuth tokens
- provider keys
- encrypted token payloads
- deleted content
- discarded session content

Exports are stored as user-controlled storage objects when R2 is configured. Download URLs are signed and owner-only.

