# No-Secrets Runtime Policy

Runtime commands may report whether secrets are present, never their values.

- Do not commit `.env`.
- Do not print provider keys, JWT secrets, Redis tokens, database passwords, or bearer tokens.
- Health endpoints may report `configured: true|false`.
- Worker logs may include task IDs, statuses, error codes, and provider names.
- Worker logs must not include raw task payloads when they may contain user-sensitive text.
- Queue failure APIs return sanitized error metadata only.
- Deployment manifests use placeholders or `sync: false` for secrets.
