# Provider Usage Tracking

Provider usage is stored in `provider_usage_events`.

Stored fields:

- provider
- model
- operation
- input/output/cached token counts when returned by the provider
- measured latency
- status
- estimated cost

Exact cost remains `null` unless pricing is explicitly configured. GORKH must not invent dollar costs from incomplete provider metadata.

The API exposes:

- `GET /governor/status`
- `GET /governor/usage`

Brain Console shows provider usage and governor status in the Quality & Governor panel.
