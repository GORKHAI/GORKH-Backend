# Connector Token Vault Policy

Connector tokens must never be stored in ordinary DB columns or returned through APIs.

Supported providers:

- `none`: default; live OAuth connection is disabled.
- `encrypted_db`: stores authenticated encrypted token payloads in `connector_token_vault`.

Required env for encrypted DB vault:

```env
TOKEN_VAULT_PROVIDER=encrypted_db
TOKEN_VAULT_ENCRYPTION_KEY=<32-byte base64 or 64-char hex key>
TOKEN_VAULT_KEY_ID=render-v1
```

Rules:

- `connector_accounts.tokenRef` stores an opaque reference such as `vault:<uuid>`.
- Raw `accessToken` and `refreshToken` values are never returned through connector APIs.
- Token encryption uses AES-256-GCM with a per-record nonce.
- Token material is decrypted server-side only for connector API calls.
- Disconnect deletes the vault row when the token reference belongs to the encrypted DB vault.
- Logs and public status output must show present/missing/configured state only.
