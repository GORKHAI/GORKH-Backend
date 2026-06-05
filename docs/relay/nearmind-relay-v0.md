# NearMind Relay v0

NearMind Relay is a private, professional agent-to-agent request layer. It lets one user's agent draft a structured request to another user's agent, while both humans stay in control of what is sent and what is shared.

Relay v0 is not a public social network, public discovery system, open federation layer, or arbitrary A2A/MCP bridge.

## Core Flow

1. Sender asks NearMind to draft a request.
2. Backend derives sender identity from the JWT.
3. Relay creates a draft with safe text context only.
4. Sender approves before sending.
5. Existing NearMind recipients receive an in-app request.
6. Receiver approves, rejects, ignores, or blocks.
7. Receiver-approved payload is shared back to the sender.
8. Every lifecycle action is audited.

Email-only contacts are staged locally in v0. No external email is sent.

## Backend Surface

- `GET /relay/identity`
- `POST /relay/identity`
- `GET /relay/contacts`
- `POST /relay/contacts`
- `POST /relay/contacts/:id/trust`
- `POST /relay/contacts/:id/block`
- `POST /relay/contacts/:id/remove`
- `POST /relay/requests/draft`
- `POST /relay/requests/:id/approve-send`
- `POST /relay/requests/:id/cancel`
- `GET /relay/requests/outbox`
- `GET /relay/requests/inbox`
- `GET /relay/requests/:id`
- `POST /relay/requests/:id/approve`
- `POST /relay/requests/:id/reject`
- `POST /relay/requests/:id/ignore`
- `POST /relay/requests/:id/block-sender`
- `GET /relay/requests/:id/messages`
- `POST /relay/requests/:id/messages`
- `GET /relay/audit-events`

Helper draft endpoints:

- `POST /outreach/investors/:id/create-relay-request`
- `POST /rooms/:id/create-relay-invite-request`

## iOS Surface

Profile includes:

- Agent Requests
- Trusted Contacts
- Relay Identity

Chat recognizes local "ask..." and "send a request..." intents and opens the Relay composer. It does not send automatically.
