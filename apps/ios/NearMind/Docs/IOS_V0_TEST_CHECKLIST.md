# NearMind iOS v0 Test Checklist

## Build

```bash
cd apps/ios/NearMind
./Scripts/build-simulator.sh
./Scripts/test-simulator.sh
```

## Manual Gateway Smoke

1. Launch NearMind in an iOS simulator.
2. Complete onboarding.
3. Open Settings.
4. Paste a valid test JWT.
5. Save the token to Keychain.
6. Return to Home and open Live Assist.
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
