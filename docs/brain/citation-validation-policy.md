# Citation Validation Policy

Every research citation must be backed by the source set returned by the configured research provider or safe fetch/extract path.

Rules:

- Citation URL must exactly match a stored or in-memory source URL after normalization.
- Citation must include a URL and title.
- Localhost, private network, non-HTTP, and blocked URLs are rejected.
- High-stakes domains require a limitation/caveat.
- GORKH cannot call a source official unless the source classifier or domain policy treats it as official.
- If an LLM cites a URL outside the source set, the answer is rejected instead of repaired with fabricated citations.

Quality metrics:

- `sourceBacked`
- `citationCount`
- `officialSourceCount`
- `highCredibilityCount`
- `freshnessScore`
- `unsupportedClaimCount`
- `overallCitationScore`
