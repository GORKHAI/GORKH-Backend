# Mobile Error Codes

Mobile-facing HTTP and WebSocket errors use:

```json
{ "code": "stable_error_code", "message": "safe message", "retryable": false, "details": {} }
```

Current stable codes include:

- `auth_missing`
- `auth_invalid`
- `consent_required`
- `unsupported_protocol_version`
- `provider_not_configured`
- `deepgram_not_configured`
- `llm_not_configured`
- `research_provider_not_configured`
- `token_vault_not_configured`
- `connector_not_connected`
- `connector_not_configured`
- `external_write_disabled`
- `profile_mutation_not_allowed`
- `budget_exceeded`
- `rate_limited`
- `session_not_found`
- `session_interrupted`
- `session_discarded`
- `invalid_message`
- `internal_error`
