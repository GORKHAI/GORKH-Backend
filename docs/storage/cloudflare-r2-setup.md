# Cloudflare R2 Setup

Set these backend environment variables only on Render/local backend environments:

```text
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=...
R2_SIGNED_URL_TTL_SECONDS=900
```

Optional:

```text
R2_PUBLIC_BASE_URL=
STORAGE_OBJECT_KEY_PREFIX=nearmind
STORAGE_DEFAULT_RETENTION_DAYS=3650
STORAGE_TRANSCRIPT_ARCHIVE_ENABLED=true
STORAGE_EXPORTS_ENABLED=true
STORAGE_MAX_OBJECT_BYTES=25000000
```

Never expose R2 credentials to iOS, web clients, logs, or public docs. iOS receives only backend-issued signed download URLs for owned objects.

Run:

```bash
env DOTENV_CONFIG_PATH=env.txt npm run storage:check
env DOTENV_CONFIG_PATH=env.txt npm run storage:r2:smoke
```

The smoke test uploads a small non-sensitive JSON object, validates head/signed URL behavior, and deletes the object.

