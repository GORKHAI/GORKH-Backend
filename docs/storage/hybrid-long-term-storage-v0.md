# NearMind Hybrid Long-Term Storage v0

NearMind uses a hybrid storage model:

- Neon/Postgres stores metadata, permissions, indexes, summaries, audit logs, and selected memory/search rows.
- Cloudflare R2 stores large durable objects such as saved transcripts, report snapshots, exports, documents, and future opt-in audio.
- Upstash/Redis is only for queues, locks, rate limits, cooldowns, and short-lived cache.

Do not describe this as unlimited storage. User-facing copy should say long-term storage with fair-use limits.

## Default Lifecycle

Saved sessions can archive transcript JSON when object storage is configured. Discarded sessions are not archived and any existing session-owned storage object is deleted or marked deleted.

Raw audio is off by default. Audio should only be stored when a user explicitly opts in to saving a recording.

## Current Objects

Storage metadata is tracked in:

- `storage_objects`
- `storage_usage`
- `storage_events`
- `memory_summaries`

Object payloads are addressed through opaque IDs. Object keys must not include user names, emails, titles, original filenames, or other PII.

## v0 Limitations

- Provider `none` is the default.
- R2 is optional and configured by environment variables.
- Export jobs run synchronously in v0 through the API/service path; worker routing can be added later.
- Backend-side envelope encryption is marked for future hardening.

