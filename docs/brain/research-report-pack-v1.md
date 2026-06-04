# Research Report Pack v1

Research Report Pack v1 gives mobile and review surfaces a stable source-backed structure:

- `answer`
- `sourceSummary`
- `keyFindings`
- `citations`
- `limitations`
- `confidence`
- `freshness`
- `nextSuggestedAction`

Every citation must map to a stored `research_sources` row. Fabricated or unmapped URLs are rejected instead of displayed. If no provider is configured, the pack can still exist with empty citations and clear limitations, but it must not invent sources.

Applies to:

- Tavily/Brave/Exa research query detail screens.
- Subagent research citation detail screens.
- Investor outreach review packs when source-backed research is available.

Schema version: `nearmind.research_report_pack.v1`.
