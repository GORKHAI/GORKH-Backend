# Adaptive Brain v0 Architecture

Adaptive Brain v0 is a safe personalization, research, tool, skill, and reflection layer for GORKH. It does not fine-tune model weights.

## Loop

1. Observe non-sensitive interaction traces: situation type, goals, cues, assistant outputs, feedback, and outcomes.
2. Reflect only after a session is saved.
3. Propose profile facts and reusable workflow skills.
4. Require confirmation for sensitive facts and all skills.
5. Apply only confirmed profile facts and approved/enabled skills.

## Modules

- `src/brain`: orchestration, routing, policies, audit, reflection.
- `src/human`: profile, profile facts, privacy classification, context graph.
- `src/personalization`: preferences, adaptation hints, feedback.
- `src/stress`: conservative stress support and crisis boundaries.
- `src/research`: research need detection, provider abstraction, fetch/extract, verification, answer composition.
- `src/tools`: tool manifests, permission policy, executor.
- `src/skills`: workflow skill proposals, approval, matching.
- `src/agents`: named internal roles as thin, controlled module boundaries.

## Storage Policy

Discarded sessions are not reflected. Interrupted sessions are not reflected. Saved sessions may create proposed facts/skills, but sensitive facts remain proposed and skills are never auto-enabled.

## Voice Integration

`conversation_agent` loads confirmed human context before answering. Deterministic preparation still wins over LLM calls. Stress support requests are handled before open-ended LLM routing. `whisper_copilot` keeps deterministic cues primary and short; research and long context remain screen/post-session only.

## Local Reference Audit

The local uploaded Hermes Agent, OpenClaw, and PersonaPlex archives were inspected statically for architecture patterns only. They are not dependencies and no external code was executed.

See `local-reference-codebase-inventory.md`, `local-reference-architecture-study.md`, `adaptive-brain-implementation-audit.md`, and `gorkh-brain-hardening-plan.md`.

GORKH keeps auditable reflection, declarative skill proposals, provider routing, public research/fetch separation, and voice gateway separation. It rejects executable skills, plugin runtimes, arbitrary browser/shell actions, and PersonaPlex/NVIDIA runtime integration in v0.
