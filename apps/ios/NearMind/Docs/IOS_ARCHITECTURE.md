# NearMind iOS Architecture

NearMind is the native SwiftUI consumer iOS app scaffold for the GORKH Brain backend.

## Structure

```text
NearMind/
  Audio/            Microphone permission, PCM16 streaming, native TTS
  App/              App state, environment, production config
  Features/         Onboarding, Home, Live Assist, Live Smoke, Settings, Debug
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

The app accepts a test JWT in Settings and stores it through `TokenStoreProtocol`.
The production implementation is `KeychainTokenStore`, backed by `KeychainStore`.
JWTs are not written to `UserDefaults`, logs, debug event rows, or source files.

Provider keys and API secrets are intentionally not represented in app settings.

## HTTP Flow

`APIClient` uses `URLSession` and the configured API base URL. It attaches the saved JWT as a Bearer token when present and currently supports:

- `GET /health`
- `GET /health/ready`
- `GET /brain/dashboard`
- `GET /mobile/sync?cursor=`
- `GET /mobile/sessions/:id/state`
- `GET /sessions/:id/latency-summary`

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

Live Assist uses `AVAudioSession` and `AVAudioEngine` only after the user taps Start Voice Session and grants microphone permission. The sequence is:

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

## Native TTS

`SpeechOutputManager` uses `AVSpeechSynthesizer` for local iOS speech. The gateway does not need to send server-side TTS audio. NearMind speaks short `gateway_client_tts_instruction` messages and short voice cues when unmuted. It ignores `screen_only` delivery and long reports.

`voice_cancel_speech` stops current local speech. The Simulate Barge-In button sends `speech_started`, stops local TTS, and then sends `speech_ended` after a short delay.

## Consent And Lifecycle

NearMind v0.2 has no hidden recording and no background always-listening. Microphone capture starts only after explicit consent, microphone permission, gateway connection, and `gateway_ack`. When the app enters background during a voice session, NearMind stops the microphone and sends `stop save=false`; the user must manually restart after returning.

## Implemented in v0

- Native SwiftUI app shell
- Consent-first onboarding
- Home, Settings, Live Assist, and Debug Log screens
- Keychain-backed JWT storage
- Production URL configuration
- Typed WebSocket session commands
- Typed live smoke screen for production API/gateway verification without microphone
- Stable mobile error decoding
- Unit tests for protocol and token-store behavior
- v0.2 branding, logo asset, consent-gated PCM16 microphone streaming, native TTS, barge-in, and lifecycle stop behavior

## Intentionally Not Implemented Yet

- Hidden or background recording
- Full Brain Console
- Provider key entry or storage
- Analytics SDKs
- Ad SDKs

## App Icon

`NearMindLogo.imageset` uses `near-mind-logo.png` copied from Downloads for in-app branding. AppIcon remains unchanged in v0.2 because a proper app icon should be generated as a complete size set from a reviewed icon design rather than faking missing variants from a single source image.

## Next Milestone

The next recommended milestone is production UX polish and TestFlight preparation: app icon generation, accessibility pass, privacy review, TestFlight signing, and manual production voice smoke evidence.
