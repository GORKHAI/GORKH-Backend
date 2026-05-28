# Google User Data Policy Notes

GORKH Google Calendar v0 uses least-privilege read-only access for user benefit:

- Purpose: show upcoming calendar context in Daily Brief and meeting prep.
- Scope: `https://www.googleapis.com/auth/calendar.events.readonly`.
- Storage: normalized event fields plus encrypted token material in the token vault.
- Token exposure: raw tokens are not sent to frontend, LLM providers, logs, or API responses.
- Writes: event creation, updates, deletion, moving, and invitation sending are disabled.
- Disconnect: connector account is marked disconnected and encrypted token material is deleted when stored in the encrypted DB vault.

Google Calendar data must not be used for diagnosis, treatment, financial/legal decisions, or autonomous external actions.
