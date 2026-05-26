# Adaptive Brain Implementation Audit

Audit date: 2026-05-26.

| Capability | Current implementation | Reference pattern | Risk | Required fix | Priority |
| --- | --- | --- | --- | --- | --- |
| Human profile facts | Confirmed/proposed facts exist with source/confidence/sensitivity | Hermes/OpenClaw memory systems emphasize cross-session context | Sensitive or interrupted-session facts could be over-retained | Add review endpoint and delete session-sourced adaptive artifacts on interruption | High |
| Profile inspection/editing | Profile and context summary existed | Memory systems provide inspectable user model | Mobile needs pending/rejected/sensitive separation | Add `/human/profile/review` | High |
| Reflection loop | Saved sessions create reflections, facts, skills | Hermes closed learning loop | Reflection must stay saved-only and auditable | Add `/brain/reflections`, audit events, no interrupted/discarded reflection | High |
| Skill learning | Declarative proposed DB skills existed | Hermes skills and OpenClaw skills/plugins | Dangerous steps could be under-detected; enabled lifecycle needed strictness | Add `validateSkillManifest`, dangerous step rejection, version rows, enabled-only matching | High |
| Tool registry | Static tool manifests existed | OpenClaw manifest/tool policy | Permission surface needs inspectability | Add `/tools/permissions` and audit invocation events | Medium |
| Stress support | Conservative detector/support/crisis boundary existed | No direct reference copied; GORKH-specific safety | Storage settings were not inspectable | Add `/stress/settings` with opt-in and crisis resource policy | High |
| Research no-provider behavior | Provider abstraction and none provider existed | OpenClaw web/search/fetch separation | Provider status and browser restrictions need API | Add `/research/providers`; keep no fake citations | High |
| Audit events | `brain_audit_events` table existed | OpenClaw lifecycle/tool event streams | Sparse event creation | Add logs for user_text, transcript, cues, assistant_text, stress support, research requests, tool invocations, skill proposals | Medium |
| Brain dashboard | Missing | Control UI patterns in OpenClaw | Mobile needs one control-surface read | Add `/brain/dashboard` | Medium |
| Voice profile adaptation | Conversation agent loaded profile context | PersonaPlex voice-state separation; Hermes user modeling | Whisper must not become long/personalized monologue | Add replay and keep cue short | Medium |
| External reference audit | Prior report used public/review language | User uploaded local archives | Cannot claim local audit without local inspection | Add inventory and local architecture study with exact files inspected | High |

## What Is Implemented Well

- Consent-first session and voice flows remain separate from adaptive learning.
- Deterministic playbooks and fast cues work without provider keys.
- Stress support is explicit self-report based and does not infer from voice tone.
- Research provider `none` produces provider-not-configured behavior without fake citations.
- Skills are declarative workflow templates, not executable code.

## Shallow Or Missing Areas

- Reflection is deterministic and conservative; it is not yet a rich evaluator.
- Research answer composition without provider keys returns snippets/status only.
- Context graph extraction remains minimal.
- Skill versioning is minimal audit history, not a full diff/revert system.

## What Should Not Be Copied

- Hermes inline-shell skill expansion.
- OpenClaw dynamic plugin execution and browser automation surfaces.
- PersonaPlex runtime/model integration inside the backend.
- Autonomous scheduled jobs, message sending, form submission, or payment/action tools.
