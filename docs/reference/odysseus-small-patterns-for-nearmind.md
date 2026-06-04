# Odysseus Small Patterns for Nearmind

This pass used `odysseus-dev.zip` as a static reference only. No Odysseus code was executed, no model downloads were run, and no large workspace features were imported.

## Patterns Accepted

- Research report packaging: consistent sections for answer, sources, citations, limitations, confidence, freshness, and next action.
- Memory/skills portability: owner-controlled JSON export/import with schema versioning.
- Task reminder channel model: represent reminder intent before adding push or email providers.
- Pre-mobile security checklist: keep unsafe workspace-style capabilities explicitly out of the mobile-ready backend.

## Patterns Rejected

- Self-hosted AI workspace shell.
- Shell tools and arbitrary code execution.
- File read/write tools for agents.
- IMAP/SMTP sending.
- CalDAV sync.
- Unrestricted MCP server/tool invocation.
- Local model serving cookbook.
- Document editor.

## Nearmind Decision

Nearmind remains a real-time assistant with consent-first voice, source-backed research, durable subagents, action approval, and no autonomous external writes. Odysseus is useful as a checklist reference, not as an architecture replacement before iOS.
