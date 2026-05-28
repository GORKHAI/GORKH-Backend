# Voice Gateway Contract v1

`/gateway/voice` accepts authenticated WebSocket traffic from browser/mobile clients and forwards safe control events to backend `/voice`.

Gateway start acknowledgement:

```json
{
  "type": "gateway_ack",
  "protocolVersion": 1,
  "serverProtocolVersion": 1,
  "gatewaySessionId": "...",
  "backendSessionId": "...",
  "backendVoiceSessionId": "...",
  "policy": "conversation_agent",
  "inputKind": "pcm16",
  "outputKind": "both",
  "asrProvider": "deepgram",
  "outputStrategy": "client_tts"
}
```

Mobile may send `speech_started` with a `speechId` and timestamp when local speech starts:

```json
{ "type": "speech_started", "speechId": "...", "timestamp": "2026-05-28T00:00:00.000Z" }
```

Screen-only subagent reports must not be spoken into earbuds. The gateway only emits `gateway_client_tts_instruction` for `voice_speak_request`.
