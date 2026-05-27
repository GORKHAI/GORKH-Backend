# Token Storage Policy

Connector tokens must never be exposed to:
- LLM prompts.
- Browser/front-end clients.
- Logs.
- Action proposal payloads.
- MCP tools.

Current implementation:
- `connector_accounts.tokenRef` stores only a reference.
- Raw token-shaped values are rejected by token-vault helpers.
- `CONNECTOR_TOKEN_VAULT=none` keeps live OAuth connection disabled.

Future implementation must use an encrypted token vault or managed secret store and return opaque references only.
