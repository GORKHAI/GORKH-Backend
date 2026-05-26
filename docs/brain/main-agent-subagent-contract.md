# Main Agent / Subagent Contract

The main agent is the only user-facing layer.

Subagents:

- receive structured tasks
- use only allowed tools
- emit progress
- produce structured reports
- support cancellation and timeout
- respect session lifecycle and retention policy
- never directly speak to the user

The main agent:

- decides whether a report should be shown
- turns reports into safe user-facing language
- keeps whisper-copilot output short
- keeps research reports screen-only during live situations
- applies medical, legal, financial, stress, and manipulation safety boundaries

No subagent may execute code, submit forms, use private browser sessions, send messages, make purchases, store sensitive stress facts without opt-in, or provide final medical/legal/financial decisions.
