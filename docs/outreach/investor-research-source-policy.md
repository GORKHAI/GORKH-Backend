# Investor Research Source Policy

Investor data must be source-backed.

## Source Handling

- Public websites, articles, news, and known investor databases may be used when available through the research provider.
- Social/profile pages are lower confidence and must be labeled accordingly.
- Login-gated pages, private sessions, browser cookies, and contact forms are not used.
- If no direct email is source-backed, the email field remains `null`.

## Stored Evidence

Each investor lead stores associated `investor_sources` with:

- URL
- title
- snippet when available
- source type
- credibility score

Fit reasons should reference the stored source context, not fabricated knowledge.

