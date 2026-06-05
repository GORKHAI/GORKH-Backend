# NearMind iOS Chat-First UX v0.5

## Product Direction

Chat is the primary NearMind interface. The app should feel like a private personal assistant that can talk through a situation, open Live Assist, summarize what needs attention, and help the user inspect memory or preferences.

Live remains the only streaming microphone mode in v0.5. Chat has a mic affordance, but tapping it does not start recording.

## Tabs

- Chat: default first tab and primary assistant surface.
- Live: consent-gated real-time voice help.
- Sessions: saved or discarded session history.
- Profile: memory, preferences, privacy, audio, approvals, diagnostics, and developer tools.

## Chat Behaviors

- `What should I do today?` reads mobile sync data when a token exists.
- `Start Live Assist` shows an approval card and opens Live after confirmation.
- `What do you remember about me?` uses profile review when available.
- `Mute voice replies` shows an approval card and changes only the local TTS mute preference.
- `Delete my memory` does not delete anything from chat; it routes to Profile & Memory.
- Unknown text uses `POST /brain/query` when a token exists.
- Without a token, Chat asks the user to add a test token in Profile.

## Approval Rules

Chat approval cards are local UI state in v0.5. They are used for navigation into Live, local TTS mute changes, and future sensitive settings. External actions, memory deletion, provider keys, API secrets, and autonomous actions are not executed from chat.

## Privacy

- JWT stays in Keychain only.
- Chat redacts JWT-shaped strings before display.
- Chat mic does not start recording.
- Live microphone starts only after consent, permission, gateway connection, and backend session ack.
- No raw audio or token payloads are logged.
