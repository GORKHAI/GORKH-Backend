# Subagent Notification Stream

Subagent events are persisted to `subagent_notifications` and exposed through authenticated polling and SSE.

## HTTP

- `GET /subagents/notifications`
- `GET /subagents/stream`
- `GET /sessions/:id/subagents/stream`
- `GET /subagents/queue/status`

SSE events include:

- `subagent_queued`
- `subagent_started`
- `subagent_progress`
- `subagent_report`
- `subagent_failed`
- `subagent_canceled`
- `subagent_expired`
- `subagent_suppressed`

The stream sends keepalive comments and closes on client disconnect. Notifications are user-owned and never expose provider secrets.
