# Voice Gateway Architecture

GORKH-Backend is the intelligence and control plane. It owns auth, user/session ownership, consent, situation briefs, trigger classification, deterministic cues, memory, retention, privacy deletion, and state transitions.

The backend `/voice` WebSocket is provider-agnostic. It accepts authenticated control events such as `start`, `user_text`, `transcript`, `speech_started`, `speech_ended`, and `stop`. It emits semantic output events such as `voice_cue`, `voice_assistant_text`, `voice_speak_request`, `voice_tts_unavailable`, and `voice_cancel_speech`.

## Voice Gateway v0

`services/voice-gateway` is now the v0 media bridge. It handles mobile/client WebSocket transport, optional ASR adapter startup, transcript forwarding, backend `/voice` bridging, gateway session debug state, and client-side TTS instructions.

The gateway still does not own product policy. Backend decisions remain provider-agnostic so ASR/TTS/full-duplex providers can change without changing the mobile control contract.

Current v0 transport:

- WebSocket JSON control events
- WebSocket binary PCM16 frames for future audio sessions
- backend `/voice` connection per gateway session
- client-side TTS through `gateway_client_tts_instruction`

## Milestone 5 Live Browser Prototype

Milestone 5 validates the first real development loop before mobile:

```text
browser microphone -> PCM16 16kHz -> voice gateway -> Deepgram ASR
-> backend /voice -> deterministic cue or DeepSeek-backed assistant/suggestion
-> gateway_client_tts_instruction -> browser SpeechSynthesis
```

DeepSeek is the current low-cost LLM provider for open-ended development paths. Deterministic preparation answers and deterministic whisper cues remain available without DeepSeek.

The browser prototype maps directly to future mobile responsibilities:

- browser SpeechSynthesis becomes native iOS/Android TTS
- browser microphone capture becomes the mobile audio engine
- WebSocket PCM transport becomes future WebRTC transport
- gateway ASR provider abstraction remains provider-agnostic

WebRTC is still a future milestone because the control protocol, consent behavior, ASR routing, and client-side TTS contract need to be stable before adding real-time media negotiation.

## Future WebRTC Gateway

A later gateway should handle real-time media transport:

- WebRTC session setup and audio transport
- microphone audio capture from the mobile app
- ASR provider streaming
- TTS provider streaming
- full-duplex speech interruption and audio playback coordination

For the first mobile prototype, TTS is client-side. The gateway forwards backend `voice_speak_request` and emits a client TTS instruction. The iOS/Android app speaks locally and handles earbud routing through the mobile OS.

## Future Provider Options

Possible provider layers to evaluate later:

- Deepgram or NVIDIA Riva for ASR
- NVIDIA/Pipecat/PersonaPlex experiments for full-duplex speech orchestration
- cloud or native TTS options for spoken output

This repository does not implement NVIDIA, Pipecat, PersonaPlex, or Riva integration yet.

NVIDIA/Pipecat/Riva remain future provider adapters or experimental branches. They should plug into the gateway/provider layer after the browser and mobile control loops are validated.

## Mobile Audio Routing

The backend can request `delivery: "earbud"` in semantic events, but the backend cannot guarantee earbud routing. The mobile app and mobile OS own audio route selection and playback behavior.

The expected future flow:

```text
mobile app microphone -> WebRTC -> voice gateway -> ASR transcript -> GORKH /voice
GORKH /voice -> semantic speak/cue request -> voice gateway -> mobile native TTS playback
```

The backend remains the source of truth for consent, retention, privacy deletion, session state, and whether a response is allowed to be spoken.

## Adaptive Brain Integration

Adaptive Brain v0 adds the profile/research/skill/reflection layer behind the same `/voice` control plane.

For `conversation_agent`, backend `/voice` now loads confirmed human context before answering, checks deterministic preparation first, handles explicit stress-support requests, detects research needs, and routes open-ended requests to the selected LLM only when required.

For `whisper_copilot`, deterministic fast cues remain first and short. Profile context may adapt style, but the gateway must still treat `voice_speak_request` as semantic text for client-side TTS. Long research or personality explanations stay screen-only or post-session.

Future mobile mapping:

- profile controls become app review/edit screens
- browser SpeechSynthesis remains native iOS/Android TTS
- browser microphone remains the mobile audio engine
- WebSocket PCM remains future WebRTC media transport
- research and skill approvals remain backend-controlled user actions
