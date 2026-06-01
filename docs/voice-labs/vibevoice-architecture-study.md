# VibeVoice Architecture Study

## A. VibeVoice-ASR

VibeVoice-ASR is useful as a reference for post-session processing, not current live voice.

Observed patterns:

- Long-form, single-pass ASR for up to 60 minutes.
- Joint ASR, diarization, and timestamping.
- Hotword/custom context support for names, domain terms, and background context.
- Multilingual and code-switching support.
- GPU-oriented runtime assumptions.

Potential GORKH/Nearmind use:

- Future saved-session analysis when the user explicitly consents to raw audio retention and post-session processing.
- Better meeting recap, owner detection, and speaker-aware commitments.
- Domain hotwords for people, companies, project names, loan terms, doctor terms, and technical vocabulary.

Not for v0:

- Live microphone ASR. Deepgram already satisfies the deployed low-latency production path.
- Discarded/interrupted sessions. They must never be processed.

## B. VibeVoice-Realtime

VibeVoice-Realtime is useful as a design reference for server-side TTS experiments.

Observed patterns:

- Streaming text input so an LLM can start speaking before a full response is complete.
- Windowed/incremental generation.
- First-audio latency target around 200-300 ms, hardware dependent.
- Websocket demo boundary.
- Single-speaker realtime variant.

Comparison to GORKH:

- GORKH currently emits `voice_speak_request` and gateway `gateway_client_tts_instruction`; browser/iOS/Android perform TTS locally.
- Native TTS is simpler, cheaper, safer, and avoids server-side synthetic voice storage.
- Realtime server TTS would add GPU/runtime cost and synthetic voice safety review.

Useful future pattern:

- Token-stream-to-audio-stream interface with cancellation and barge-in.
- Explicit buffering and cancellation contract.
- Screen-only vs audible delivery separation.

## C. VibeVoice-TTS

VibeVoice-TTS is not needed for Nearmind v0.

Reasons:

- Long-form multi-speaker generation is not required for real-time assistant cues.
- It increases impersonation and deepfake risk.
- The upstream repository notes the TTS code was removed after misuse concerns.
- It would complicate consent, disclosure, storage, and abuse monitoring.

Decision:

- Do not enable long-form/multi-speaker TTS.
- Do not implement voice cloning.
- Do not expose custom speaker cloning paths.

## D. Security And Safety

Required controls for any future lab:

- Explicit user consent.
- Clear disclosure that speech is AI-generated.
- No celebrity/public-person imitation.
- No impersonation of private people.
- No hidden generated speech.
- No third-party deception.
- No emotional manipulation or relationship persuasion use cases.
- No production enablement without a separate policy and abuse-review milestone.

## GORKH-Native Design Decision

VibeVoice remains a provider lab only. The production path stays Deepgram plus native/client TTS.
