# NearMind iOS UI Design Notes

## Navigation

NearMind uses a native four-tab structure:

- Chat: default home and main personal-assistant interface.
- Live: explicit consent-based real-time voice-session workflow.
- Sessions: saved-session browsing and detail.
- You: account, memory, privacy, requests, preferences, audio, and internal developer tools.

The app intentionally avoids a web-style landing page. Onboarding is a short three-step flow, then users land in Chat.

## Design System

The brand base is dark green `#06402B`. `NearMindTheme` defines the shared background, elevated background, card surface, border, CTA colors, text colors, status colors, badge treatment, spacing, and radius values.

The UI uses compact native cards, small status badges, section headers, and empty states. The NearMind logo appears as a small app mark instead of a large hero block.

## Product Screens

Chat focuses on the relationship with the assistant: a small NearMind header, assistant welcome, message list, optional briefing card, quick action chips, and a native input bar. Chat can summarize today, propose opening Live, show memory review summaries, open the private request composer, and ask the backend for general answers when a test token exists.

Live is the focused action screen. Inactive state shows situation, context, consent, and Start Live Assist. Policy/title live behind More options. Active state prioritizes listening status, audio route, mic level, current cue/guidance, short transcript preview, stop/discard, save, mute, and barge-in. Transcript notes and diagnostics are secondary disclosures.

Sessions lists saved interactions and opens a detail view with summary, cues, follow-ups, and transcript snippets. Latency and diagnostics are secondary.

You is intentionally simple at the top level. Account, Memory, Privacy, Requests, Preferences, Audio, and Developer each navigate to deeper screens. Token entry remains Keychain-only and is intentionally nested under You > Developer.

Requests live under You > Requests. Relay is intentionally not a public feed or discovery surface. In the app, the user-facing language is “Requests from people,” “Requests you sent,” and “Needs approval,” with approval cards at send/share decision points.

## Consumer vs Developer Surfaces

Consumer-facing:

- Chat
- Live
- Sessions
- You memory/preferences/privacy/audio sections

Developer-facing:

- Typed Live Smoke
- Raw debug event log
- Backend endpoint details
- Real-device smoke checklist
- Latency diagnostics
- Relay request inbox/outbox and approval diagnostics

Developer surfaces are reachable through You > Developer only, so the default app feels product-ready instead of development-first.
