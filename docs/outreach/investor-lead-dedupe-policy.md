# Investor Lead Dedupe Policy

Lead dedupe is conservative.

## Matching Rules

- Normalize firm names by removing common suffixes like `VC`, `Venture Capital`, `Partners`, and legal suffixes.
- Normalize website domains by removing `www`.
- Mark duplicates when domains match.
- Mark duplicates when canonical firm names match and partner names do not conflict.
- Do not merge solely on vague similarity.

## Merge Rules

- Merge only through explicit review.
- Preserve all sources by moving them to the target lead.
- Preserve fit reasons, risk flags, sectors, stages, and geographies.
- Mark the old record as `merged`.

