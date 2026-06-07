# Deepgram Aura Setup

Natural Voice uses Deepgram Aura through the Voice Gateway only. Provider keys never go to iOS.

Required gateway env for live Natural Voice:

```bash
NATURAL_VOICE_ENABLED=true
TTS_PROVIDER=deepgram_aura
DEEPGRAM_API_KEY=...
DEEPGRAM_TTS_VOICE_CALM=...
DEEPGRAM_TTS_VOICE_PROFESSIONAL=...
DEEPGRAM_TTS_VOICE_WARM=...
DEEPGRAM_TTS_VOICE_WHISPER=...
DEEPGRAM_TTS_VOICE_BRIEFING=...
```

Optional:

```bash
TTS_MAX_TEXT_CHARS=600
TTS_WHISPER_MAX_TEXT_CHARS=120
TTS_REQUEST_TIMEOUT_MS=10000
TTS_CACHE_ENABLED=false
TTS_AUDIO_STORE_ENABLED=false
```

Run:

```bash
npm run tts:replay:all
npm run tts:live:verify
```

If Natural Voice is not configured, `tts:live:verify` exits with `not_configured` instead of faking success.
