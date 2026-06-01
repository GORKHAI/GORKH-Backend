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

The current lightweight web room page fetches backend tokens and redacts them in the UI. A future dedicated frontend bundle can include the LiveKit browser SDK.
