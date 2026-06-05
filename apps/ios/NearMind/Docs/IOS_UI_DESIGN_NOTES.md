# NearMind iOS UI Design Notes

## Navigation

NearMind uses a native four-tab structure:

- Today: default home and calm overview.
- Assist: primary Live Assist voice-session workflow.
- Sessions: saved-session browsing and detail.
- Settings: account, privacy, audio, diagnostics, and developer tools.

The app intentionally avoids a web-style landing page. Onboarding is a short three-step flow, then users land on Today.

## Design System

The brand base is dark green `#06402B`. `NearMindTheme` defines the shared background, elevated background, card surface, border, CTA colors, text colors, status colors, badge treatment, spacing, and radius values.

The UI uses compact native cards, small status badges, section headers, and empty states. The NearMind logo appears as a small app mark instead of a large hero block.

## Product Screens

Today focuses on one primary action, Start Live Assist, plus brief, follow-up, upcoming, and recent-session previews. Empty states are quiet and action-oriented.

Assist is the core action screen. Inactive state shows context, policy, consent, and Start Session. Active state shows live status, microphone state, route, TTS mute, transcript/cue previews, barge-in, save/discard stop, and disconnect.

Sessions lists saved interactions and opens a detail view with summary, cues, follow-ups, and transcript snippets. Latency and diagnostics are secondary.

Settings groups token, privacy, audio, diagnostics, and developer tools. Token entry remains Keychain-only.

## Consumer vs Developer Surfaces

Consumer-facing:

- Today
- Assist
- Sessions
- Settings account/privacy/audio sections

Developer-facing:

- Typed Live Smoke
- Raw debug event log
- Backend endpoint details
- Real-device smoke checklist
- Latency diagnostics

Developer surfaces are reachable through Settings only, so the default app feels product-ready instead of development-first.
