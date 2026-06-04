# Memory and Skills Portability

Memory/Skills Export/Import v0 is owner-only and credential-free.

Export includes:

- confirmed profile facts
- optional proposed/rejected facts when requested
- non-sensitive preferences by default
- enabled skills

Export never includes:

- raw tokens
- connector credentials
- stress or psychological sensitive facts unless explicitly requested and allowed
- cross-user data

Import behavior:

- creates profile facts as `proposed` by default
- creates skills as `proposed` by default
- never auto-confirms sensitive items
- skips stress-sensitive imports unless opt-in is explicit
- validates skill manifests before insertion

Schema version: `nearmind.memory_skills.v0`.
