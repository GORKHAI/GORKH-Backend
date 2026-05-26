# Subagent Safety Policy

Subagents are restricted internal workers. They cannot bypass GORKH's main safety policy.

Denied capabilities:

- arbitrary shell or code execution
- form submission
- login browser access
- payment
- sending messages without approval
- hidden recording
- medical diagnosis
- manipulation advice
- final financial decisions
- final legal decisions
- private browser session access

Research subagents require `allowResearch=true`.

Memory/profile subagents require `allowMemory=true` or `allowProfileContext=true`.

Stress-support subagents require an explicit stress-support request or opted-in context. They do not infer stress from voice tone and do not store sensitive stress patterns without opt-in and confirmation.

When a session is discarded or interrupted, related pending subagents are canceled or suppressed. Late reports are ignored.
