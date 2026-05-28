# Mobile Protocol v1

GORKH mobile clients must send `protocolVersion: 1` in every voice/gateway `start` message.

If omitted, servers temporarily accept the start message and emit `protocol_version_missing`. If the version is below or above the supported range, servers reject the start with `unsupported_protocol_version`.

Mobile clients must never send `userId`; identity comes only from the bearer JWT.

Core rules:
- No microphone frames before explicit user consent and a successful start acknowledgement.
- Reconnect does not restart recording or auto-save content.
- Mobile TTS is local. The backend and gateway emit text/TTS instructions only.
- Provider keys, OAuth tokens, and connector secrets never belong on-device.

Start message:

```json
{
  "type": "start",
  "protocolVersion": 1,
  "policy": "conversation_agent",
  "consent": { "granted": true, "method": "tap", "noticeText": "Live Assist is active." },
  "input": { "kind": "text" },
  "output": { "kind": "both" },
  "retentionPolicy": "ask_on_stop"
}
```

Acknowledgements include `protocolVersion` and `serverProtocolVersion`.
