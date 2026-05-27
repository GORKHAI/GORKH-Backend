# Google Calendar Read-Only Plan

First supported scope:
- `https://www.googleapis.com/auth/calendar.readonly`

Allowed in v0 readiness:
- Show scope and consent text.
- Store connector account metadata.
- Import fixture/manual calendar items for tests.
- Read normalized `calendar_event` records already present in `connector_items`.

Disabled:
- Creating events.
- Updating events.
- Canceling events.
- Inviting attendees.
- Sending notifications.

Calendar writes must remain action proposals until a future explicit write-approval milestone.
