# Cost and Latency Governor

The governor routes work through the cheapest safe path.

Decision ladder:

1. deterministic rule
2. cached result
3. profile/memory lookup
4. cheap LLM
5. research subagent
6. stronger LLM
7. human approval required

Configuration:

- `GOVERNOR_ENABLED=true`
- `GOVERNOR_MODE=cheap|balanced|quality`
- `GOVERNOR_DAILY_LLM_BUDGET_USD`
- `GOVERNOR_DAILY_RESEARCH_BUDGET_USD`
- `GOVERNOR_MAX_LLM_LATENCY_MS`
- `GOVERNOR_MAX_RESEARCH_LATENCY_MS`
- `GOVERNOR_PREFER_DETERMINISTIC=true`

If budget is exhausted, GORKH returns `provider_budget_exceeded`. It does not fabricate an answer.
