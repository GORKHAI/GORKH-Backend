# Research Quality Tuning

GORKH uses provider-backed research only when a request needs live or source-backed facts. The v0 quality layer plans the query, classifies the domain, selects source policy, tunes Tavily options, validates citations, and records evaluation events.

## Tavily Tuning

- `TAVILY_DEFAULT_TOPIC=general`
- `TAVILY_DEFAULT_SEARCH_DEPTH=basic`
- `TAVILY_MAX_RESULTS=6`
- `TAVILY_ENABLE_EXTRACT=true`
- `TAVILY_EXTRACT_MAX_URLS=3`

Topic selection:

- `news/current` uses Tavily `news`.
- finance/market queries may use Tavily `finance`.
- normal research uses `general`.

Depth selection:

- high-stakes or source-verification queries use `advanced`.
- low-risk/general queries use configured default depth.

No result is fabricated. If Tavily is unavailable or returns no valid source URLs, the caller receives a provider error or empty-source result.
