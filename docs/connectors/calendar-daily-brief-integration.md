# Calendar Daily Brief Integration

Synced Google Calendar events are stored as normalized `connector_items` rows:

- `provider=google_calendar`
- `itemType=calendar_event`
- `title`
- `summary` with links redacted
- `startsAt`
- `endsAt`
- sanitized metadata
- sensitivity classification

Daily Brief uses connected-account calendar events for:

- upcoming meetings and appointments
- meeting prep prompts
- prep-needed risk items where relevant

Disconnected accounts are ignored. Calendar events are context only; they do not create tasks or commitments automatically unless existing Daily Life policies propose them for review.
