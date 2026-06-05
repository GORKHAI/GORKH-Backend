# NearMind iOS UI Design Notes

## Navigation

NearMind uses a native four-tab structure:

- Chat: default home and main personal-assistant interface.
- Live: explicit consent-based real-time voice-session workflow.
- Sessions: saved-session browsing and detail.
- Profile: memory, preferences, privacy, audio, approvals, diagnostics, and developer tools.

The app intentionally avoids a web-style landing page. Onboarding is a short three-step flow, then users land in Chat.

## Design System

The brand base is dark green `#06402B`. `NearMindTheme` defines the shared background, elevated background, card surface, border, CTA colors, text colors, status colors, badge treatment, spacing, and radius values.

The UI uses compact native cards, small status badges, section headers, and empty states. The NearMind logo appears as a small app mark instead of a large hero block.

## Product Screens

Chat focuses on the relationship with the assistant: a small NearMind header, assistant welcome, message list, quick action chips, and a native input bar. Chat can summarize today, propose opening Live, show memory review summaries, and ask the backend for general answers when a test token exists.

Live is the focused action screen. Inactive state shows context, policy, consent, and Start Voice Session. Active state shows live status, microphone state, route, TTS mute, transcript/cue previews, barge-in, save/discard stop, and disconnect.

Sessions lists saved interactions and opens a detail view with summary, cues, follow-ups, and transcript snippets. Latency and diagnostics are secondary.

Profile groups memory, preferences, privacy, audio, approvals, diagnostics, and developer tools. Token entry remains Keychain-only and is intentionally nested under Developer.

Agent Requests live under Profile > Approvals. Relay is intentionally not a public feed or discovery surface. It appears as a private inbox/outbox/composer for professional requests, with approval cards at send/share decision points.

## Consumer vs Developer Surfaces

Consumer-facing:

- Chat
- Live
- Sessions
- Profile memory/preferences/privacy/audio sections

Developer-facing:

- Typed Live Smoke
- Raw debug event log
- Backend endpoint details
- Real-device smoke checklist
- Latency diagnostics
- Relay request inbox/outbox and approval diagnostics

Developer surfaces are reachable through Profile only, so the default app feels product-ready instead of development-first.
