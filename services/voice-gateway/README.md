# Voice Gateway

The voice gateway is the v0 media bridge for mobile prototypes. GORKH-Backend remains the intelligence/control plane; the gateway owns client transport, optional ASR bridging, backend `/voice` forwarding, and client-side TTS instructions.

It does not generate audio, fake ASR transcripts, fake TTS, fake LLM output, or implement NVIDIA/Riva/Pipecat/PersonaPlex.

## Local Setup

From the repo root:

```bash
npm install
npm run setup:local
npm run dev
npm run gateway:dev
```

Gateway defaults:

```text
VOICE_GATEWAY_PORT=3010
GORKH_BACKEND_HTTP_URL=http://127.0.0.1:3000
GORKH_BACKEND_WS_URL=ws://127.0.0.1:3000
VOICE_GATEWAY_ASR_PROVIDER=none
VOICE_GATEWAY_OUTPUT_STRATEGY=client_tts
```

Live browser console:

```bash
npm run gateway:live:check
npm run gateway:live:open
```

Then open `/dev/live` on the forwarded gateway port. The dev page is disabled in production.

## WebSocket

Connect to:

```text
WS /gateway/voice
Authorization: Bearer <jwt>
```

or:

```text
WS /gateway/voice?token=<jwt>
```

Start text:

```json
{
  "type": "start",
  "policy": "conversation_agent",
  "situationDescription": "I am going to the bank to discuss a loan",
  "title": "Bank prep",
  "consent": {
    "granted": true,
    "method": "user_tap",
    "noticeText": "Live Assist is active. I confirm I have the right consent for this conversation.",
    "participantCount": 1,
    "jurisdiction": "unknown"
  },
  "input": { "kind": "text" },
  "output": { "kind": "both" },
  "retentionPolicy": "ask_on_stop"
}
```

Start PCM:

```json
{
  "type": "start",
  "policy": "whisper_copilot",
  "situationDescription": "I am talking with a bank about a loan",
  "title": "Bank live assist",
  "consent": {
    "granted": true,
    "method": "user_tap",
    "noticeText": "Live Assist is active. I confirm I have the right consent for this conversation.",
    "participantCount": 2,
    "jurisdiction": "unknown"
  },
  "input": { "kind": "pcm16", "sampleRate": 16000, "channels": 1 },
  "output": { "kind": "both" },
  "retentionPolicy": "ask_on_stop"
}
```

PCM requirements:

- PCM16
- 16kHz
- mono
- binary frames only after a consented `pcm16` start
- frame size no larger than `GATEWAY_MAX_PCM_FRAME_BYTES`

If `VOICE_GATEWAY_ASR_PROVIDER=none`, PCM start fails with `gateway_provider_error` and no fake transcript is created.

ASR routing policy:

- `conversation_agent` microphone finals are forwarded to backend `/voice` as `user_text`
- `whisper_copilot` microphone finals are forwarded as `transcript`
- typed user text always forwards `user_text`
- typed transcript always forwards `transcript`

Conversation-agent microphone flow:

```text
Browser mic -> PCM16 AudioWorklet -> gateway ASR -> user_text -> backend /voice -> assistant text -> client TTS instruction
```

Whisper-copilot microphone flow:

```text
Browser mic -> PCM16 AudioWorklet -> gateway ASR -> transcript -> backend triggers/cues -> client TTS instruction
```

DeepSeek open-ended flow:

```text
user_text -> backend /voice -> selected LLM provider deepseek -> voice_assistant_text -> voice_speak_request -> gateway_client_tts_instruction
```

## Client-Side TTS

The gateway does not generate audio. When backend `/voice` emits:

```json
{ "type": "voice_speak_request", "speechId": "...", "text": "Ask total repayment.", "delivery": "earbud" }
```

the gateway forwards it unchanged and emits:

```json
{
  "type": "gateway_client_tts_instruction",
  "speechId": "...",
  "text": "Ask total repayment.",
  "delivery": "earbud",
  "sourceEvent": "voice_speak_request",
  "maxWords": 8
}
```

The mobile client should speak this text locally using native TTS. On `voice_cancel_speech`, the mobile client should stop native speech for the matching `speechId`.

The browser dev page uses SpeechSynthesis only for local validation. If muted or unavailable, it still logs the instruction.

## Latency Metrics

Gateway sessions may emit:

```json
{
  "type": "gateway_metrics",
  "latencyMs": {
    "gatewayToAsrFinal": 120,
    "gatewayToBackend": 18,
    "backendToGateway": 0,
    "gatewayToClientTtsInstruction": 0
  }
}
```

These are development metrics for observing the loop, not strict service-level guarantees.

## Replays

Run backend and gateway first, then:

```bash
npm run gateway:replay -- text-prep-bank
npm run gateway:replay -- text-whisper-bank
npm run gateway:replay -- text-prep-doctor
npm run gateway:replay -- text-whisper-doctor
npm run gateway:replay -- pcm-missing-asr
npm run gateway:replay:all
```

## Tests

```bash
npm run gateway:test
npm run gateway:test:integration
```

Integration tests require backend dependencies, Postgres, and Redis. Use `npm run setup:local`.

## Deepgram Manual Check

Set:

```text
VOICE_GATEWAY_ASR_PROVIDER=deepgram
DEEPGRAM_API_KEY=<real key>
```

Then start a `pcm16` gateway session and send real PCM16 16kHz mono frames. The gateway forwards final ASR transcripts to backend `/voice`; it does not fabricate transcripts.

For browser validation, use `/dev/live`, choose `microphone_pcm16`, grant browser microphone permission, check consent, and start the session. If microphone permission is denied, no audio is captured or sent.

## DeepSeek Setup

Set:

```text
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=<real key>
DEEPSEEK_CHAT_MODEL=deepseek-v4-flash
```

Preparation-style prompts remain deterministic without DeepSeek. Open-ended prompts emit `provider_not_configured` when the key is missing.

## Troubleshooting

- Browser mic permission denied: reload `/dev/live`, allow microphone access, and restart the session.
- No forwarded port: forward the gateway port and open `/dev/live` from that public URL.
- Deepgram key missing: text mode works; microphone PCM mode emits `gateway_provider_error`.
- DeepSeek key missing: deterministic prep/cues work; open-ended LLM requests emit `provider_not_configured`.
- No ASR finals: confirm `VOICE_GATEWAY_ASR_PROVIDER=deepgram`, the gateway was restarted, and the browser is sending microphone frames.
- SpeechSynthesis muted or unavailable: unmute in the page or check browser speech settings.
- Audio feedback or echo: use headphones/earbuds and lower speaker volume.

## Limitations

- Current transport is WebSocket; WebRTC is future work.
- TTS is client-side only.
- ASR provider `none` supports text-mode sessions only.
- No NVIDIA, Riva, Pipecat, or PersonaPlex integration is implemented.
