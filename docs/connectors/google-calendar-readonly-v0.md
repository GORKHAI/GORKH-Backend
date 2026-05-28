# Google Calendar Read-Only Connector v0

Google Calendar v0 gives GORKH calendar context without enabling external writes.

Implemented behavior:

- OAuth readiness and read-only start/callback routes.
- Allowed v0 scope: `https://www.googleapis.com/auth/calendar.events.readonly`.
- Encrypted token vault storage through opaque `tokenRef`.
- Read-only event listing from Google Calendar.
- Normalized `connector_items` with `itemType=calendar_event`.
- Daily Brief consumption of synced events from connected accounts only.
- Brain Console controls for readiness, sync preview, sync, events, disconnect, and consent audit.

Not implemented in v0:

- Creating, updating, moving, or deleting calendar events.
- Sending invitations.
- Gmail scopes or Gmail OAuth.
- Token exposure to frontend, LLM prompts, logs, or API responses.

If OAuth env or token vault env is missing, the connector returns `oauth_not_configured` or `connector_not_connected`. It does not create fake accounts or fake events.
