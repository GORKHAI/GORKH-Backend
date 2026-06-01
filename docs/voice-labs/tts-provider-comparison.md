# TTS Provider Comparison

| Provider | Latency | Cost | Privacy | Complexity | Misuse Risk | Mobile Fit | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| iOS native TTS | Low | Device/system | Strong; local output | Low | Low | Excellent | Use for iOS v0 |
| Android native TTS | Low | Device/system | Strong; local output | Low | Low | Excellent | Use for Android v0 |
| Browser SpeechSynthesis | Variable | Browser/system | Local output | Low | Low | Dev/prototype only | Keep for browser ops |
| Deepgram TTS | Low if hosted | Provider usage | Audio sent to provider | Medium | Medium | Possible later | Not v0 |
| VibeVoice-Realtime | Claimed low first audio in lab | Self-host GPU/runtime | Depends on hosting | High | High | Lab only | Disabled |
| OpenAI/ElevenLabs/etc. | Usually low | Provider usage | Audio/text sent to provider | Medium | Medium/high | Possible future | Requires policy review |

## Decision

Mobile v0 uses native TTS. VibeVoice-Realtime remains a disabled provider lab because it adds model runtime complexity and synthetic voice safety obligations.
