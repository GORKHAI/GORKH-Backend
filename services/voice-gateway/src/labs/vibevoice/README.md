# VibeVoice Provider Lab

This directory contains interfaces and disabled stubs for a future VibeVoice lab.

Production rules:

- Deepgram remains the production ASR provider.
- Native/browser TTS remains the production output path.
- VibeVoice is not selectable by the normal gateway provider config.
- No model weights, demos, or downloads are required.
- No voice cloning or impersonation is allowed.
- If the lab is selected without an explicit lab runtime, providers return `provider_not_configured`.

The lab exists only to preserve clean integration boundaries for future offline experiments.
