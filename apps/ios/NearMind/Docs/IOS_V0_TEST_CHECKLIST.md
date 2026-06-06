# NearMind iOS v0 Test Checklist

## Build

```bash
cd apps/ios/NearMind
./Scripts/list-simulators.sh
./Scripts/build-simulator.sh
./Scripts/test-simulator.sh
```

If `./Scripts/test-simulator.sh` reports no runtime/device, install an iOS simulator runtime in Xcode Settings, then rerun it. Until then, `xcodebuild build-for-testing` can validate that the app and unit test bundle compile.

Backend `npm test` is separate from iOS validation and requires local backend env, including `DATABASE_URL` and Redis/Upstash configuration. Do not commit `.env`, JWTs, provider keys, or API secrets.

## Typed Live Smoke

1. Launch NearMind in an iOS simulator.
2. Complete onboarding.
3. If Auth Welcome appears, tap Use test token.
4. Paste a valid test JWT.
5. Save the token to Keychain and verify token status shows `stored`.
6. Open Developer, then Typed Live Smoke.
7. Tap API health check.
8. Tap Connect.
9. Tap Start conversation_agent.
10. Tap Send bank prep user_text.
11. Confirm assistant text or expected provider/deterministic event is received.
12. Tap Stop save=false in Conversation Agent.
13. Tap Start whisper_copilot.
14. Tap Send APR transcript.
15. Confirm `voice_cue` is received.
16. Tap Stop save=false in Whisper Copilot.
17. Tap Fetch mobile sync.
18. Tap Fetch session state.
19. Tap Fetch latency summary.
20. Open Debug Log and confirm no token appears in logs.

Typed live smoke must not start microphone capture, native TTS, push notifications, Calendar/Gmail UI, provider key entry, API secret storage, or any `userId` field in WebSocket payloads.

## Auth And Account Shell v0

1. Clear the local Keychain token or launch on a fresh install.
2. Complete onboarding.
3. Confirm Auth Welcome appears with NearMind logo, Continue with Apple, Continue with Email, and a small Use test token link.
4. Tap Continue with Email and confirm the app says email sign-in is not enabled in this alpha.
5. Tap Continue with Apple only on a signed-in simulator/device. If backend Apple auth is disabled, confirm a clear not-enabled message appears.
6. Tap Use test token and paste a valid backend JWT.
7. Confirm the app enters Chat/Live/Sessions/Profile.
8. Open Profile and confirm Account and Plan sections appear above developer tools.
9. Confirm Plan says Internal Alpha and billing is not enabled.
10. Open Account and tap Sign out. Confirm the app returns to Auth Welcome and the local token is cleared.
11. Sign in again with a test token.
12. Open Account > Account deletion.
13. Submit a deletion request and confirm the backend response message appears.
14. Cancel the pending deletion request.
15. Confirm Debug Log does not show the JWT or any Apple identity token.

## Voice + TTS Smoke

Conversation test:

1. Paste a valid test JWT in Profile > Developer.
2. Open Live.
3. Select `conversation_agent`.
4. Enter situation:

```text
Bank loan meeting preparation.
```

5. Check consent.
6. Tap Start Voice Session.
7. Grant microphone permission when iOS prompts.
8. Say:

```text
What should I ask before this bank loan meeting?
```

9. Expect ASR final text to appear.
10. Expect assistant text to appear.
11. Expect native iOS TTS to speak if TTS is unmuted and the gateway emits `gateway_client_tts_instruction`.
12. Tap Stop save=false.
13. Confirm the microphone level returns to off/zero.

Whisper test:

1. Select `whisper_copilot`.
2. Check consent.
3. Tap Start Voice Session.
4. Say:

```text
The APR is 9.4 percent and there is also an arrangement fee.
```

5. Expect ASR final text to appear.
6. Expect `voice_cue` to appear.
7. Expect native iOS TTS to speak the short cue if unmuted.
8. Confirm long `screen_only` subagent reports are not spoken.
9. Tap Simulate Barge-In.
10. Confirm TTS stops.
11. Tap Stop save=false.
12. Confirm the microphone stops and the session is discarded.

Privacy checks:

1. Start a voice session, then background the app. Confirm the microphone stops and the app shows the v0.3 background warning.
2. Start another voice session, then tap Disconnect. Confirm the microphone and TTS stop.
3. Open Debug Log and confirm no token appears.
4. Confirm raw audio frames are not logged.
5. Confirm `stop save=false` is available and used for discard tests.

## Real Device Voice Smoke v0.3

Use `IOS_REAL_DEVICE_SMOKE.md` for the full physical iPhone checklist. The Live Assist screen includes a Real Device Smoke section with local checklist state for:

1. Token stored.
2. Microphone permission granted.
3. Gateway connected.
4. `conversation_agent` started.
5. ASR final received.
6. Assistant text received.
7. TTS spoken.
8. `whisper_copilot` started.
9. Cue received.
10. Barge-in tested.
11. Stop save=false tested.
12. Mic stopped.
13. TTS stopped.
14. Session state fetched.
15. Latency summary fetched.
16. No token in logs.
17. No raw audio in logs.

## Manual Typed Gateway Smoke

1. Launch NearMind in an iOS simulator.
2. Complete onboarding.
3. Open Profile.
4. Paste a valid test JWT.
5. Save the token to Keychain.
6. Open Live.
7. Tap Connect.
8. Select `conversation_agent`.
9. Enter a title and situation description.
10. Enable consent.
11. Tap Start Text Session.
12. Send typed user text:

```text
What should I ask before this bank loan meeting?
```

13. Expect `voice_assistant_text` or a provider/deterministic response in the event log.
14. Disconnect, reconnect if needed, and select `whisper_copilot`.
15. Start a typed session with consent.
16. Send typed transcript:

```text
The APR is 9.4 percent and there is also an arrangement fee.
```

17. Expect `voice_cue` in the event log.
18. Tap `Stop save=false`.
19. Tap Disconnect.
20. Verify the app does not crash and the debug log does not display the JWT.

## Chat-First Smoke v0.5

1. Complete onboarding and confirm the first tab is Chat.
2. Confirm the assistant welcome says:

```text
Tell me what’s happening, or ask me what needs attention today.
```

3. Tap `Start Live Assist`.
4. Confirm an approval card appears and microphone recording does not start.
5. Tap `Open Live` and confirm the app switches to Live without starting a session.
6. Return to Chat and ask:

```text
Mute voice replies
```

7. Confirm an approval card appears; tap Confirm and verify Profile shows voice replies muted.
8. Ask:

```text
Delete my memory
```

9. Confirm NearMind does not delete anything and offers to open Profile & Memory.
10. Remove the token, ask an unknown question, and confirm Chat says to add a test token in Profile.
11. Paste a token in Profile > Developer and ask:

```text
Ask Steve's agent if he is available for an investor call next week.
```

12. Confirm NearMind opens the Relay composer instead of sending automatically.

## Relay Agent Requests v0

1. Paste a valid test JWT in Profile > Developer.
2. Open Profile > Agent Requests.
3. Confirm Inbox, Outbox, Drafts, and Approvals tabs are visible.
4. Tap Draft a Relay request.
5. Enter recipient:

```text
Steve
```

6. Enter request:

```text
Ask if next week works for an investor call.
```

7. Tap Create Draft.
8. Confirm an approval card appears.
9. Tap Send Request.
10. Confirm no external email is sent.
11. Open Outbox and confirm the request status updated.
12. Open Chat and ask:

```text
Ask this investor if they want the deck.
```

13. Confirm Chat opens the Relay composer and does not send automatically.
14. Open Debug Log and confirm no token, raw audio, provider key, or client `userId` appears.

```text
What should I do today?
```

12. Confirm Chat uses mobile sync data or shows a quiet empty state.
13. Tap the Chat mic button and confirm it does not start recording; use Live for voice sessions.
