# Provider-Live Research Validation

GORKH research defaults to `RESEARCH_PROVIDER=none`. In that state the backend must return `provider_not_configured` and must not fabricate results, snippets, answers, or citations.

## Providers

Supported v0 provider adapters:

- `brave`: Brave Search Web Search API with `X-Subscription-Token`.
- `tavily`: Tavily Search API with bearer authorization.
- `exa`: Exa search endpoint with content snippets requested under `contents`.

Provider keys are optional at boot and must never be printed.

## Commands

```sh
npm run research:check
npm run research:replay -- bank-apr
npm run research:replay -- doctor-test-results
npm run research:replay -- company-brief
npm run research:replay:all
```

When no provider is configured, these commands exit successfully with an explicit `provider_not_configured` message.

When a provider is configured, the replay expects real provider results. It prints sanitized titles and domains only. If an answer is synthesized, citations must point to returned source URLs.

## Safety Rules

- HTTP fetch is GET-only.
- No cookies or auth headers are sent.
- Localhost, private network, link-local, and internal IP targets are blocked.
- `file://`, `ftp://`, POST, forms, browser login, and private browser sessions are not supported.
- Medical, legal, and financial research must include limitations and must not make final decisions.
- If an LLM is unavailable, GORKH returns source lists/snippets only rather than inventing a polished answer.
# Provider-Live Research Validation

Research providers are optional. `RESEARCH_PROVIDER=none` is a valid development state and must return `provider_not_configured` without fake results or citations.

## Commands

- `npm run research:check`
- `npm run research:replay:all`
- `npm run subagents:replay -- research-live-if-configured`
- `npm run research:live:all`
- `npm run subagents:live-research:all`

If Brave, Tavily, or Exa is configured, the replay must validate that returned citations are source-backed and have non-empty URLs. If no provider is configured, it exits 0 with a clear skip message.

Subagent provider-live validation uses the durable worker path, not an inline mock.

Recommended first provider is Tavily because it is designed for agent search/research workflows:

```bash
RESEARCH_PROVIDER=tavily
TAVILY_API_KEY=[secret]
```

Provider-live validation requires real source URLs. If no LLM is configured, GORKH returns source lists/snippets only rather than synthesizing an answer.
