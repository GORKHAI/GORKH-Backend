# Mobile Sync Contract v1

Mobile should use cursor polling in addition to WebSocket/SSE:

- `GET /mobile/notifications?cursor=&limit=`
- `POST /mobile/notifications/:id/ack`
- `POST /mobile/notifications/ack-batch`
- `GET /mobile/sync?cursor=&limit=`

`/mobile/sync` returns a cursor and changed items for notifications, subagent reports, action proposals, daily briefs, tasks, commitments, connector sync summaries, and session status.

Discarded session content is excluded by policy. Acknowledging a notification does not delete it.
