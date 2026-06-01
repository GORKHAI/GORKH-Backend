# VibeVoice Reference Inventory

Date: 2026-06-01

## Inspection Status

No local `VibeVoice` folder or archive was present in this repository. The reference inspection used the public Microsoft repository only:

- Repository: https://github.com/microsoft/VibeVoice
- License: MIT license, as reported by the repository and docs.
- Inspection mode: static documentation/source-structure review only.
- Not performed: no clone, no install, no demo execution, no model download, no inference.

## Files And Pages Inspected

- `README.md`: model family overview, release history, risks/limitations.
- `docs/vibevoice-asr.md`: ASR model behavior, installation assumptions, evaluation summary.
- `docs/vibevoice-realtime-0.5b.md`: realtime TTS behavior, websocket demo shape, latency claims, limitations.
- `LICENSE`: repository license indicator.
- `pyproject.toml`: Python package/dependency entrypoint indicator.

## Model Families

- `VibeVoice-ASR-7B`: long-form ASR model intended for up to 60 minutes of audio in one pass.
- `VibeVoice-Realtime-0.5B`: streaming text-to-speech model intended for low first-audio latency and streaming text input.
- `VibeVoice-TTS-1.5B`: long-form multi-speaker TTS family. The public README states the TTS code was removed from the repository after misuse inconsistent with the stated research intent.

## ASR Components

Documented ASR capabilities:

- Single-pass processing for long audio up to 60 minutes.
- Structured transcript output with speaker, timestamp, and text.
- Customized hotwords/user context.
- Multilingual and code-switching support across more than 50 languages.
- vLLM and Hugging Face Transformers integration are referenced by the upstream project.

## TTS Components

Documented TTS capabilities:

- Long-form multi-speaker generation up to 90 minutes.
- Up to four speakers for long-form conversational speech.
- Expressive speech and multilingual examples.

Production risk: this category has the highest impersonation/deepfake risk and is not needed by GORKH/Nearmind v0.

## Realtime TTS Components

Documented realtime capabilities:

- 0.5B parameter model.
- Streaming text input.
- Approximate first-audio latency around 200-300 ms, hardware dependent.
- Long-form generation around 10 minutes.
- Single-speaker realtime variant.
- English-first behavior; multilingual voices are experimental.

## Server / Client Structure

The upstream docs describe:

- Python demo scripts for ASR and realtime TTS.
- A realtime websocket demo for TTS.
- File-based inference scripts.
- Recommended NVIDIA PyTorch containers and GPU-oriented runtime setup.

## Dependencies And Runtime Assumptions

The upstream docs recommend NVIDIA containers, CUDA/GPU runtime, ffmpeg for demos, and optional FlashAttention. VibeVoice should therefore be treated as a lab/runtime dependency, not a default backend dependency.

## Production Risks

- Heavy model/runtime footprint.
- GPU/CUDA operational complexity.
- Deepfake and impersonation risk for synthetic voice.
- Generated speech disclosure and consent requirements.
- Potential unexpected/bias/inaccuracy inherited from base models.
- Upstream project itself does not recommend real-world/commercial deployment without further testing.

## GORKH Decision

GORKH will inspect VibeVoice as a reference only. Production remains:

- Deepgram for live ASR.
- Client-side/native TTS through `gateway_client_tts_instruction`.
- No server-side synthetic voice in production.
- No voice cloning or impersonation.
