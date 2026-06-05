# NearMind iOS Local Setup

## Requirements

- Xcode with iOS 17 or newer SDK support.
- An installed iOS simulator runtime and at least one iPhone simulator device. Install via Xcode -> Settings -> Platforms.
- XcodeGen 2.40.0 or newer.

Install XcodeGen if needed:

```bash
brew install xcodegen
```

## Build And Test

```bash
cd apps/ios/NearMind
./Scripts/list-simulators.sh
./Scripts/build-simulator.sh
./Scripts/test-simulator.sh
```

If no simulator runtime/device is installed, `test-simulator.sh` fails clearly and lists available destinations. Use:

```bash
xcodebuild -project NearMind.xcodeproj -scheme NearMind -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build-for-testing
```

to validate that the app and unit test bundle compile until a simulator can execute XCTest.

## Backend Environment

The iOS build does not require a local backend. NearMind uses:

- API: `https://api.gorkh.com`
- Gateway WebSocket: `wss://voice.gorkh.com/gateway/voice`
- Gateway HTTP: `https://voice.gorkh.com`

Backend `npm test` is a separate validation path. It requires local backend env, including `DATABASE_URL` and Redis/Upstash settings. Do not treat missing backend env as an iOS app failure.

## Test JWT

Get a test JWT from the deployed backend/operator flow, open NearMind Settings, paste it into the secure field, and tap Save token to Keychain.

Token policy:

- JWTs are stored only in Keychain.
- JWTs are never stored in `UserDefaults`.
- JWTs are never hardcoded.
- JWTs must not appear in Debug Log rows.
- Provider keys and API secrets do not belong in the app or docs.
- Do not commit `.env`, JWTs, screenshots containing JWTs, provider keys, or API secrets.

## Live Smoke Scope

The v0.1 live smoke screen verifies typed sessions only:

- API health.
- Gateway connect.
- `conversation_agent` typed `user_text`.
- `whisper_copilot` typed `transcript`.
- `stop save=false`.
- Mobile sync, session state, and latency summary fetches when a session ID exists.

It intentionally does not implement microphone streaming, native TTS, push notifications, Calendar/Gmail UI, full Brain Console UI, provider key storage, API secret storage, hidden recording, or client-sent `userId`.
