# NearMind iOS Architecture

NearMind is the native SwiftUI consumer iOS app scaffold for the GORKH Brain backend.

## Structure

```text
NearMind/
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

`GatewayWebSocketClient` connects to `wss://voice.gorkh.com/gateway/voice` with the saved Bearer JWT. It sends typed JSON client events only:

- `start`
- `user_text`
- `transcript`
- `speech_started`
- `speech_ended`
- `stop`

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
- `input.kind = "text"`
- `output.kind = "both"`
- `retentionPolicy = "ask_on_stop"`

It does not include `userId`; identity is derived from the Bearer token.

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

## Intentionally Not Implemented Yet

- Microphone capture
- Hidden or background recording
- Native TTS playback
- Audio streaming
- Full Brain Console
- Provider key entry or storage
- Analytics SDKs
- Ad SDKs
