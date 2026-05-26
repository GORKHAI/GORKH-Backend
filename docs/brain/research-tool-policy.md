# Research Tool Policy

Research v0 is provider-backed and citation-first. If no provider is configured, GORKH returns `provider_not_configured` and does not fabricate results.

Research is needed for:

- Current/latest/recent information.
- Prices, rates, laws, regulations, policies.
- Official source verification.
- Required documents.
- Medical/legal/financial factual lookups.
- Company/person/background checks before meetings.

Research is not needed for:

- Deterministic cue generation.
- Generic playbook preparation.
- Meeting summaries.
- Memory/profile lookup.

Fetch policy:

- HTTP GET only.
- No cookies.
- No auth headers.
- No POST.
- No form submission.
- No browser login.
- Local/private network fetches are blocked outside explicit tests.

Source policy:

- Official and academic sources are preferred for high-stakes domains.
- Company docs can support product/pricing claims.
- News can support recent events.
- Forums/social sources are low confidence unless explicitly requested.
- No citations are invented.

`GET /research/providers` exposes selected provider status and browser restrictions. Browser provider is `none` in v0; fetch remains GET-only, unauthenticated, cookie-free, form-free, and blocks private/local network targets.

Brain Console may call `/research/providers`, `/research/query`, and `/brain/query`, but it must display `provider_not_configured` when no provider key is configured. Provider-live validation must use the real Brave, Tavily, or Exa adapter and must never fabricate URLs, snippets, fetched content, or citations.

The replay commands `research:check`, `research:replay`, and `research:replay:all` are the current provider-live validation path. They print sanitized titles/domains only and never print provider keys.
