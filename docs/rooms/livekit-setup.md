# LiveKit Setup

Required env for real room/token operations:

```env
ROOMS_ENABLED=true
ROOMS_PROVIDER=livekit
LIVEKIT_URL=https://your-livekit-host
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
ROOMS_PUBLIC_BASE_URL=https://voice.gorkh.com
```

Never expose `LIVEKIT_API_SECRET` to the browser. The frontend receives only short-lived participant tokens minted by the backend.

## Token Policy

- Host: room join, publish audio/video, subscribe, data messages.
- Guest: room join, publish audio/video, subscribe, no admin privileges.
- AI agent: disabled by default; observer/listener only if enabled.

The staging web room page now bundles `livekit-client` from `services/voice-gateway/src/room-client/room-client.ts`.

Build it with:

```bash
npm run rooms:web:build
```

## Token Response Shape

Host and guest token endpoints return only:

- participant token;
- `livekitUrl`;
- room identifiers;
- `participantRole`;
- `expiresAt`;
- publish/subscribe permissions.

They must not return `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, campaign data, or private outreach data to guests.

## Live Checks

```bash
npm run rooms:live:check
npm run rooms:live:token-check
npm run rooms:live:browser-checklist
```

The first two commands validate configuration and token generation. The browser checklist is required for real camera/audio join validation.
