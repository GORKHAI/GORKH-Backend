# External Agent Patterns Review

This review is architecture input only. GORKH does not integrate Hermes Agent, OpenClaw, NVIDIA PersonaPlex, Riva, Pipecat, or any external autonomous-agent framework in Adaptive Brain v0.

## Sources Reviewed

- Hermes Agent repository: https://github.com/nousresearch/hermes-agent
- OpenClaw web tools documentation: https://docs.openclaw.ai/tools/web
- OpenClaw browser documentation entry: https://docs.openclaw.ai/browser
- NVIDIA PersonaPlex project page: https://research.nvidia.com/labs/adlr/personaplex/
- NVIDIA PersonaPlex repository: https://github.com/NVIDIA/personaplex

## Hermes Patterns

Hermes presents a personal agent with a closed learning loop: persistent memory, skill creation from experience, skill improvement during use, provider routing, and search over past conversations. The useful pattern for GORKH is not autonomous self-modification; it is the observe, reflect, propose, confirm, apply loop.

GORKH copies these patterns:

- Session-end reflection over saved sessions only.
- Candidate profile facts and candidate skills as proposed records.
- Provider abstraction instead of a single hard-coded model.
- Past context retrieval through explicit memory/profile systems.

GORKH does not copy:

- Autonomous skill enablement.
- Scheduled unattended actions.
- Shell/code execution.
- Messaging platform automation.
- Broad filesystem or browser-session access.

## OpenClaw Patterns

OpenClaw separates lightweight `web_search` / `web_fetch` tools from full browser automation. That separation is important for GORKH because web search/fetch can be SSRF-restricted, citation-oriented, and read-only, while browser automation introduces login, cookies, form submission, and purchase risks.

GORKH copies these patterns:

- Tool registry with explicit manifests.
- Separate web search, web fetch, browser, and skill capabilities.
- Provider-specific adapters behind stable interfaces.
- Disabled browser provider in v0.

GORKH does not copy:

- Community plugin installation.
- Arbitrary skill files that can grant real-world action powers.
- Browser login/session/cookie access.
- Form submission.
- Shell execution.

## PersonaPlex / NVIDIA Voice Patterns

PersonaPlex is relevant as voice-state inspiration only: full-duplex conversation, interruption/barge-in, persona or role conditioning, and keeping voice behavior aligned with context. GORKH already keeps voice provider integration separate from the backend control plane.

GORKH copies these concepts:

- Role/policy separation between `conversation_agent` and `whisper_copilot`.
- Barge-in and cancellation as first-class state.
- Short voice outputs for live situations.
- Provider-agnostic gateway design.

GORKH does not copy:

- Speech-to-speech model implementation.
- NVIDIA APIs or model assumptions.
- Server-side TTS in this milestone.
- Persona/role control that overrides safety boundaries.

## Security Risks

Uncontrolled skill/plugin systems can exfiltrate data, perform hidden actions, execute code, pollute persistent memory, or exploit tool-call chains. For GORKH, the highest-risk categories are external messaging, browser session access, payments, forms, shell execution, sensitive profile writes, and medical/legal/financial decisions.

Adaptive Brain v0 therefore stores skills as workflow templates only. They cannot execute arbitrary code. New skills start as `proposed`, require user approval, and are not auto-enabled.

## GORKH-Native Decision

Adaptive Brain v0 implements a controlled personalization and learning engine:

- Human profile facts are confirmed or proposed with sensitivity labels.
- Sensitive psychological/stress facts require opt-in and confirmation.
- Reflection runs only after saved sessions.
- Discarded/interrupted sessions do not create profile facts or skills.
- Research is provider-backed or returns `provider_not_configured`; no fake citations.
- Tools are allowlisted and permission-checked.
- Skills are reusable workflow templates, not executable plugins.
