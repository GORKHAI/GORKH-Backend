# NearMind Natural Voice v0.7

Natural Voice makes NearMind sound less robotic while keeping local iOS TTS as the default fallback.

## Defaults

- Native iOS TTS is the default voice output.
- Natural Voice is opt-in.
- Generated audio is not stored by default.
- Only assistant response text or short cue text is sent to the TTS provider.
- Microphone audio is never sent to the TTS provider.

## Gateway Flow

1. iOS receives `gateway_client_tts_instruction`.
2. If the user selected Native Voice, iOS uses `AVSpeechSynthesizer`.
3. If the user selected Natural Voice, iOS calls `POST /tts/synthesize` on the Voice Gateway.
4. The Voice Gateway validates auth, text length, purpose, voice character, and safety policy.
5. The gateway calls Deepgram Aura server-side when configured.
6. iOS plays returned audio data.
7. If Natural Voice fails and fallback is enabled, iOS uses native TTS.

## Safety Boundary

Natural Voice is not voice cloning. NearMind does not imitate real people, celebrities, friends, investors, bosses, partners, or the user.
