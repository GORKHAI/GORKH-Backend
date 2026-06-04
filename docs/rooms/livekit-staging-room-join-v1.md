# LiveKit Staging Room Join v1

Nearmind Rooms v1 turns the v0 token prototype into a real browser LiveKit join flow for staging. It keeps the production safety boundaries unchanged: no recording, no transcription before consent, no AI speaking into investor calls, no email sending, and no calendar writes.

## Browser Client

The voice gateway serves the browser room client:

- Host: `/rooms/ui/:roomId`
- Guest: `/r/:inviteToken`
- Bundle: `/rooms/room.js`
- Styles: `/rooms/room.css`

`room.js` is built from `services/voice-gateway/src/room-client/room-client.ts` with:

```bash
npm run rooms:web:build
```

The client uses the bundled `livekit-client` package. It does not use CDN scripts and does not receive LiveKit API keys or secrets.

## Host Flow

1. Open `/rooms/ui/:roomId`.
2. Paste a host JWT.
3. Click `Load Room`.
4. Tick the consent checkbox.
5. Click `Join LiveKit Room`.
6. The browser fetches `POST /rooms/:id/host-token`, connects to LiveKit, and publishes camera/microphone only after the Join click.

## Guest Flow

1. Open `/r/:inviteToken`.
2. Click `Load Room`.
3. Enter display name/email if needed.
4. Tick the consent checkbox.
5. Click `Grant Guest Consent`.
6. Click `Join LiveKit Room`.
7. The browser fetches `POST /rooms/guest/:inviteToken/token`, connects to LiveKit, and publishes camera/microphone only after the Join click.

If consent is denied or pending, guest token issuance is blocked.

## Token Response

Room token endpoints return:

```json
{
  "token": "livekit-participant-jwt",
  "livekitUrl": "wss://...",
  "roomId": "...",
  "providerRoomName": "...",
  "participantRole": "host",
  "expiresAt": "...",
  "permissions": {
    "canPublish": true,
    "canSubscribe": true,
    "canPublishData": true
  }
}
```

Responses must not include `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, campaign details, private outreach data, or internal config.

## Media Behavior

The browser client:

- handles LiveKit connection state;
- attaches local camera preview after Join;
- attaches subscribed remote audio/video tracks;
- shows participant connect/disconnect events;
- detaches tracks on leave/disconnect/page unload;
- logs errors without claiming fake success.

Manual browser testing is still required to validate real camera/audio behavior.

## Scripts

```bash
npm run rooms:live:check
npm run rooms:live:token-check
npm run rooms:live:browser-checklist
```

If LiveKit is not configured, the live checks exit successfully with `rooms_not_configured` and do not fake a join.
