# Subagent Research Workflow

The research subagent is a side-channel source checker.

## Flow

1. Main agent detects a research need.
2. Main agent starts a `research` subagent with `allowResearch=true`.
3. Main agent immediately continues with deterministic playbook guidance.
4. Research subagent checks provider configuration.
5. If a provider is configured, it searches public sources and verifies source credibility.
6. If no provider is configured, it returns `provider_not_configured`.
7. Main agent summarizes the report safely.

## No-Provider Behavior

When `RESEARCH_PROVIDER=none` or the selected provider key is missing:

- no source lookup is performed
- no citations are fabricated
- report status is `failed`
- `providerStatus.errorCode` is `provider_not_configured`
- recommended main-agent message explains that live web verification is unavailable

## Live Delivery

For `whisper_copilot`, research reports are screen-only. The assistant may say a short cue such as "Research ready on screen" in a later milestone, but v0 does not speak long research summaries into earbuds.
