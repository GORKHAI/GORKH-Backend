# Pre-Mobile Security Checklist

Before mobile clients ship, Nearmind must continue to enforce:

- no public dev consoles
- no shell tools
- no file read/write tools exposed to agents
- no unrestricted MCP
- no raw token exposure
- no fake citations
- no hidden recording
- no private browser/session/cookie access
- no external send without approval
- no connector writes
- no secrets in logs, docs, Render config, or public JavaScript
- no server-side TTS by default
- no room recording by default

Automated check:

```bash
npm run security:pre-mobile-check
```

The automated check is intentionally conservative. It scans the mobile-sensitive surfaces and prints file/path/rule names only, never secret values.
