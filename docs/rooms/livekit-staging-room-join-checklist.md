# LiveKit Staging Room Join Checklist

Use this checklist after deploying API, gateway, worker, and LiveKit env.

## A. Configure LiveKit

- `ROOMS_ENABLED=true`
- `ROOMS_PROVIDER=livekit`
- `LIVEKIT_URL` is set.
- `LIVEKIT_API_KEY` is set server-side only.
- `LIVEKIT_API_SECRET` is set server-side only.
- `ROOMS_PUBLIC_BASE_URL=https://voice.gorkh.com` or the staging gateway URL.
- `ROOMS_REQUIRE_CONSENT=true`
- `ROOMS_RECORDING_ENABLED=false`
- `ROOMS_AI_AGENT_SPEAKING_ENABLED=false`

Run:

```bash
npm run rooms:live:check
npm run rooms:live:token-check
```

## B. Create Room

1. Open protected Brain Console.
2. Create a room or create one from an investor lead.
3. Create a guest link.
4. Open host page: `https://voice.gorkh.com/rooms/ui/<roomId>`.
5. Open guest page in private/incognito or another browser: `https://voice.gorkh.com/r/<inviteToken>`.

## C. Host And Guest Join

Host:

- Paste host JWT.
- Click `Load Room`.
- Tick consent.
- Click `Join LiveKit Room`.
- Grant browser camera/microphone permissions.
- Verify local preview appears.

Guest:

- Click `Load Room`.
- Enter display name/email.
- Tick consent.
- Click `Grant Guest Consent`.
- Click `Join LiveKit Room`.
- Grant browser camera/microphone permissions.
- Verify local preview appears.

Both sides:

- Verify remote video appears.
- Verify audio is audible.
- Verify participant list updates.
- Verify event log shows `connected`, `participant_connected`, and `track_subscribed`.
- Click Leave and confirm browser camera/microphone indicators stop.

## D. Consent And Transcript

- Before guest consent, host transcript ingestion must fail with `consent_required`.
- After guest consent, host transcript ingestion can store manual transcript segments.
- Generate summary.
- Confirm a draft follow-up action proposal is created only.
- Confirm no email is sent.

## E. Security

- Browser network responses must not contain `LIVEKIT_API_KEY` or `LIVEKIT_API_SECRET`.
- Guest page must not expose outreach campaign/private data.
- No recording button is visible.
- AI does not speak into the room.
- No Google Meet room is created.

Do not mark browser media join as passed until real host/guest camera and audio are verified in the browser.
