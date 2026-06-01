# GORKH vs VibeVoice Gap Analysis

| Capability | Current GORKH | VibeVoice pattern | Useful? | Risk | Decision |
| --- | --- | --- | --- | --- | --- |
| Live ASR | Deepgram via Voice Gateway | VibeVoice-ASR long-form, single-pass | Partly | GPU/runtime latency unknown for live | Keep Deepgram live |
| Post-session ASR | No raw audio analysis pipeline | 60-minute ASR with speaker/timestamps | Yes | Requires saved audio consent | Design only in v0 |
| Speaker diarization | Live transcript speaker labels depend on ASR path | Who/When/What structured output | Yes | May be wrong; needs review | Future post-session lab |
| Hotwords | Not provider-lab surfaced | Customized hotwords/context | Yes | Privacy-sensitive context injection | Future saved-session opt-in |
| Live TTS | Browser/native TTS instruction | Realtime server-side TTS | Maybe later | Synthetic voice/deepfake risk | Keep native TTS v0 |
| TTS barge-in | Client/gateway cancel contract | Server audio stream cancellation | Useful as pattern | Server buffering complexity | Document future contract |
| Long-form TTS | Not present | 90-minute multi-speaker synthesis | No for v0 | High misuse risk | Do not copy |
| Voice cloning/custom voice | Not present | Voice prompt/speaker expansion concepts | No | Impersonation | Explicitly blocked |
| Protocol | Mobile protocol v1 | Demo-specific websocket | No direct copy | Demo not product contract | Keep GORKH protocol |
| Consent | Consent-first sessions | Research demos | GORKH stronger | Hidden/unclear demo consent | Keep GORKH consent |
| Subagents | Durable background workers | Not primary pattern | No | N/A | Keep GORKH subagents |
| Notifications | Cursor/ack mobile sync | Not observed as product feature | No | N/A | Keep GORKH mobile sync |
| Latency | Per-session summaries | First-audio latency target | Yes | Hardware-dependent claims | Add benchmark checklist only |

## Prioritized Follow-Ups

1. Complete manual browser/mobile mic validation with Deepgram.
2. Add optional saved-audio consent and storage policy only if post-session audio processing is needed.
3. Benchmark VibeVoice-ASR separately in a lab with real saved audio, GPU/runtime metrics, and no production traffic.
4. Keep server-side synthetic voice out of production until a dedicated safety review.
