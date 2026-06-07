# NearMind iOS Architecture

NearMind is the native SwiftUI consumer iOS app scaffold for the GORKH Brain backend.

## Structure

```text
NearMind/
  Audio/            Microphone permission, route monitoring, PCM16 streaming, native TTS
  App/              App state, tab routing, environment, production config
  Features/         Onboarding, Auth, Chat, Live Assist, Sessions, You, Account, Live Smoke, Debug
  Networking/       API client, endpoint routing, WebSocket gateway client
  Protocol/         Codable client/server protocol and mobile errors
  Security/         Keychain and token storage abstractions
  UI/Components/    Small reusable SwiftUI components
```

## Backend URLs

- API: `https://api.gorkh.com`
- Gateway WebSocket: `wss://voice.gorkh.com/gateway/voice`
- Gateway HTTP: `https://voice.gorkh.com`

## Token Storage

After onboarding, the app shows Auth Welcome when no Keychain JWT exists. It accepts Sign in with Apple readiness, Email readiness, or a small internal test-token path. The app accepts a test JWT in You > Developer and stores it through `TokenStoreProtocol`.
The production implementation is `KeychainTokenStore`, backed by `KeychainStore`.
JWTs are not written to `UserDefaults`, logs, debug event rows, or source files.

Provider keys and API secrets are intentionally not represented in app settings.

## Consumer Navigation

NearMind now uses a native chat-first four-tab structure after onboarding:

- Chat: default home and primary interface. Users ask NearMind for help, today context, memory summaries, or to open consented Live Assist.
- Live: the focused real-time voice-session screen for context, consent, microphone/TTS controls, and live transcript/cue display.
- Sessions: saved-session browse and detail UI with summaries, cues, follow-ups, transcript snippets, and secondary diagnostics.
- You: account, memory, privacy/data controls, requests, preferences, audio settings, and de-emphasized developer tools.

Developer-heavy surfaces are intentionally not shown on the default home screen. Typed Live Smoke and the raw debug event log are available through You > Developer.

## HTTP Flow

`APIClient` uses `URLSession` and the configured API base URL. It attaches the saved JWT as a Bearer token when present and currently supports:

- `GET /health`
- `GET /health/ready`
- `GET /brain/dashboard`
- `POST /brain/query`
- `GET /human/profile/review`
- `POST /auth/apple/verify`
- `POST /auth/email/start`
- `POST /auth/email/verify`
- `GET /account/me`
- `POST /account/sign-out`
- `POST /account/delete-request`
- `POST /account/delete-cancel`
- `GET /plans/me`
- `GET /billing/status`
- `GET /mobile/sync?cursor=`
- `GET /mobile/sessions/:id/state`
- `GET /sessions/:id/latency-summary`
- `GET /relay/identity`
- `GET /relay/contacts`
- `GET /relay/requests/inbox`
- `GET /relay/requests/outbox`
- `POST /relay/requests/draft`
- `POST /relay/requests/:id/approve-send`
- `POST /relay/requests/:id/cancel`
- `POST /relay/requests/:id/approve`
- `POST /relay/requests/:id/reject`
- `POST /relay/requests/:id/ignore`
- `POST /relay/requests/:id/block-sender`

## WebSocket Flow

`GatewayWebSocketClient` connects to `wss://voice.gorkh.com/gateway/voice` with the saved Bearer JWT. It sends JSON client events:

- `start`
- `user_text`
- `transcript`
- `speech_started`
- `speech_ended`
- `stop`

For voice sessions it also sends binary PCM16 audio frames over the same WebSocket after the backend has acknowledged the session. Raw audio is not logged.

Incoming gateway and voice events are decoded into `GatewayServerEvent`. Unknown future events fall back to `.unknown` and are appended to the debug log without crashing.
Known gateway operational events include `gateway_error`, `gateway_warning`, and `gateway_metrics` so live smoke output stays readable.
The client tracks connection state, gateway/backend/voice session IDs, last error code, and event count for live smoke checks.

## Protocol Version

The mobile gateway protocol constant is `protocolVersion = 1`.

The start payload includes:

- `protocolVersion: 1`
- `policy`
- `situationDescription`
- `title`
- `consent.granted`
- `consent.method = "user_tap"`
- `consent.noticeText`
- `consent.participantCount`
- `consent.jurisdiction`
- `input.kind = "text"` for typed sessions
- `output.kind = "both"`
- `retentionPolicy = "ask_on_stop"`

Voice sessions use:

- `input.kind = "pcm16"`
- `input.sampleRate = 16000`
- `input.channels = 1`
- `output.kind = "both"`
- `retentionPolicy = "ask_on_stop"` by default

It does not include `userId`; identity is derived from the Bearer token.

## Audio Capture

Live Assist uses `AVAudioSession` and `AVAudioEngine` only after the user taps Start Live Assist and grants microphone permission. Microphone permission uses the iOS 17+ `AVAudioApplication` APIs. The sequence is:

1. Verify JWT status is stored.
2. Verify the consent checkbox is enabled.
3. Request microphone permission.
4. Connect the gateway if needed.
5. Send a `protocolVersion = 1` start payload with `input.kind = "pcm16"`.
6. Wait for `gateway_ack`.
7. Start `AVAudioEngine`.
8. Convert input audio with `AVAudioConverter` to PCM16 16 kHz mono.
9. Send binary frames to the gateway while the WebSocket and session remain active.

If conversion fails, NearMind stops the microphone and reports the error. The microphone also stops on stop, disconnect, Live Assist close, and app background.

## Audio Route Handling

`AudioSessionManager` configures `.playAndRecord` with `.voiceChat`, Bluetooth options, and default speaker output. It exposes the current route as a small `AudioRouteInfo` model so Live Assist can show built-in mic, speaker, headphones, Bluetooth, or other routes. Route changes are observed while Live Assist is configured. If an active microphone session loses its input route, NearMind stops capture and reports the route failure instead of continuing silently.

Native TTS routes through the current system output. Earbuds are supported, but real meeting tests should compare the phone microphone against earbud microphones because phone placement often captures room audio more reliably.

## Native TTS

`SpeechOutputManager` uses `AVSpeechSynthesizer` for local iOS speech. The gateway does not need to send server-side TTS audio. NearMind speaks short `gateway_client_tts_instruction` messages and short voice cues when unmuted. It ignores `screen_only` delivery and long reports.

`voice_cancel_speech` stops current local speech. The Simulate Barge-In button sends `speech_started`, stops local TTS, and then sends `speech_ended` after a short delay.

## Assistant-First UX

The Chat tab is the app center in v0.6. `ChatViewModel` handles safe local intent routing before backend calls:

- “Start Live” creates an approval card and switches to Live only after the user confirms. It never starts the microphone.
- “Mute voice replies” and “Unmute voice replies” create local approval cards and update only the non-sensitive native TTS preference.
- “Delete my memory” does not execute deletion from chat. It routes the user to You > Memory for review.
- “Ask someone” or “Ask Steve...” opens the private request composer. Nothing is sent automatically.
- “What should I do today?” reads mobile sync data when a token is available.
- “What do you remember about me?” reads the profile review endpoint when available.
- Unknown text uses `POST /brain/query` if a token is stored, with profile context allowed and profile mutation disabled.

Chat messages redact JWT-shaped strings before displaying or storing local message state. Sensitive external actions are not executed from chat in v0.6.

## Auth And Account Shell

Auth v0 introduces `AuthWelcomeView`, `AuthViewModel`, `AppleSignInButtonView`, and `EmailSignInView`. Apple and email auth are callable but disabled by default on the backend, so the app displays clear not-enabled errors instead of pretending login is active.

`AppState` loads auth status from Keychain, fetches `/account/me` after launch when a token exists, and clears account state when the token is removed. Sign out calls `/account/sign-out` when possible and always clears the local Keychain token afterward.

The You tab replaces Profile as the personal settings hub. It shows only high-level Account, Memory, Privacy, Requests, Preferences, Audio, and Developer rows at the top level. Plan status is read-only: Internal Alpha, billing disabled, and subscriptions coming later. There is no StoreKit, purchase button, price, fake paywall, or payment link in this milestone.

## Relay Architecture

NearMind Relay v0 is exposed in `Features/Relay`. It is a private agent request inbox/outbox, not a public social layer. The iOS app can:

- Open Requests from You.
- Browse Inbox, Outbox, Drafts, and Pending approvals.
- Draft a request to a named/email contact.
- Approve sender-side send.
- Cancel drafts.
- Approve, reject, ignore, or block incoming requests.
- Decode Relay mobile-sync items.

All Relay API calls attach the Keychain JWT through `APIClient`. iOS never sends `userId`; backend ownership is derived from auth. Chat "ask..." intents open the Relay composer and do not send automatically.

## Consent And Lifecycle

NearMind v0.3 has no hidden recording and no background always-listening. Microphone capture starts only after explicit consent, microphone permission, gateway connection, and `gateway_ack`. When the app enters background during a voice session, NearMind stops the microphone and sends `stop save=false`; the user must manually restart after returning.

## Real Device Smoke And Latency

Live Assist includes a local Real Device Smoke checklist for physical iPhone testing. The checklist records token, permission, gateway, ASR, assistant, TTS, whisper cue, barge-in, discard stop, session state, latency, and manual log privacy checks.

Local latency is approximate and uses device timestamps for mic start, first ASR final, first cue, first TTS instruction, and local TTS start. Backend latency is fetched from `GET /sessions/:id/latency-summary` and displayed only when the backend provides metrics such as `transcriptToAssistantTextMs`, `asrToCueMs`, `cueToGatewayInstructionMs`, `subagentDurationMs`, or warnings. The app does not fabricate missing backend metrics.

## Implemented in v0

- Native SwiftUI app shell
- Consent-first onboarding
- Native Chat, Live, Sessions, and You tabs
- Debug Log and Typed Live Smoke screens behind You > Developer
- Keychain-backed JWT storage
- Production URL configuration
- Typed WebSocket session commands
- Typed live smoke screen for production API/gateway verification without microphone
- Stable mobile error decoding
- Unit tests for protocol and token-store behavior
- v0.2 branding, logo asset, consent-gated PCM16 microphone streaming, native TTS, barge-in, and lifecycle stop behavior
- v0.3 AppIcon generation, real-device scripts, audio route UI, real-device smoke checklist, and latency display
- v0.4 consumer UI redesign with tab navigation, compact onboarding, Today home, Sessions browse/detail, and diagnostics separation
- v0.5 chat-first UX with approval cards, text assistant routing, and no hidden recording from chat
- v0.6 assistant-first UX polish with You tab, simplified Live flow, hidden developer surfaces, and human approval cards
- Relay v0 agent requests under You > Requests, Chat composer handoff, mobile-sync decoding, and sender/receiver approval controls
- Auth/account/plan shell v0 with Auth Welcome, Apple/email readiness, account profile, sign out, deletion request, and status-only Internal Alpha plan

## Intentionally Not Implemented Yet

- Hidden or background recording
- Full Brain Console
- Provider key entry or storage
- Analytics SDKs
- Ad SDKs
- StoreKit purchases, fake pricing, or paywalls

## App Icon

`NearMindLogo.imageset` uses `near-mind-logo.png` copied from Downloads for in-app branding. v0.3 generates `AppIcon.appiconset` from that square source using `Scripts/generate-app-icon.sh`. The original logo image set remains available for in-app branding.

## Next Milestone

The next recommended milestone is a real-device UX pass: capture iPhone screenshots/video for onboarding, auth, Chat, Live inactive/active, Sessions, and You, then tune spacing and copy from physical-device evidence.
