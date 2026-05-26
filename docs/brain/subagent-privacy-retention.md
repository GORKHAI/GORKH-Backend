# Subagent Privacy and Retention

Subagents inherit the session privacy policy. They cannot bypass consent, retention, or main-agent safety rules.

## Discarded Sessions

When a session is discarded, queued/running subagent tasks tied to that session are suppressed, task controllers are canceled, reports/findings are deleted, and late writes are ignored.

## Interrupted Sessions

When a socket disconnects without explicit stop, related running subagents are canceled or suppressed. No memory extraction, reflection, or user-facing late report is emitted from interrupted session output.

## Saved Sessions

Saved-session reports may be retained and used for reflection only when non-sensitive and policy-safe. Sensitive facts are never auto-confirmed.
