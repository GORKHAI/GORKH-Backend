# Connector Manifest Layer v0

The connector layer describes future integrations without enabling them by default.

## Registered Connectors

- `google_gmail`
- `google_calendar`
- `microsoft_outlook`
- `notion`
- `slack`
- `todoist`
- `github`
- `mcp_remote`

All connectors are disabled and unconfigured in v0. OAuth is represented only as a placeholder contract.

## Permissions

Permission names are explicit and conservative:

- `read_email_headers`
- `read_email_body`
- `draft_email`
- `send_email_requires_approval`
- `read_calendar`
- `propose_calendar_event`
- `create_calendar_event_requires_approval`
- `read_documents`
- `write_documents_requires_approval`
- `read_tasks`
- `create_task_requires_approval`
- `mcp_tool_invoke_requires_manifest`
- `mcp_network_disabled_by_default`

The registry is inspectable through:

- `GET /connectors`
- `GET /connectors/:id`
- `GET /connectors/:id/permissions`

No provider keys or tokens are returned.
