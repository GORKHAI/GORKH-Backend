# Synthetic Voice Safety Policy

## Product v0 Rules

- No voice cloning.
- No celebrity or public-person imitation.
- No impersonation of private people.
- No hidden generated speech.
- No generated speech used to deceive third parties.
- No relationship, persuasion, or manipulation scenarios using synthetic emotional speech.
- No server-side TTS provider enabled in production without policy review.
- No generated audio stored by default.

## Required Future Controls

Before any server-side synthetic voice provider can be enabled:

- Explicit user consent.
- Clear AI-generated speech disclosure.
- Abuse-case review.
- Watermark/disclosure plan where practical.
- Rate limits and audit logging.
- No custom voice import unless a separate consent and identity verification policy exists.

## VibeVoice Lab Policy

VibeVoice provider stubs are disabled by default and cannot generate audio. The lab rejects cloning and impersonation modes even outside production.
