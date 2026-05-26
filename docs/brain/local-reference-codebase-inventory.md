# Local Reference Codebase Inventory

Inventory date: 2026-05-26.

Safe discovery from the repository root found three local uploaded archives. They were extracted for static inspection into `.reference-agent-labs/`, which is gitignored. No reference code was executed, installed, or imported into GORKH.

| Reference | Path | Type | Inspected | Runtime/language | License | Package files | Main/static entrypoints | Notable architecture folders | Missing files |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hermes Agent | `hermes-agent-main.zip`; extracted `.reference-agent-labs/hermes-agent-main` | Archive + extracted directory | Yes, static only | Python 3.11+, TypeScript/Node support tooling | MIT via `LICENSE` and package metadata | `pyproject.toml`, `package.json`, `Dockerfile` | `cli.py`, `agent/`, `gateway/`, `acp_adapter/`, `cron/`, `tools/`, `skills/` | `agent`, `gateway`, `tools`, `skills`, `cron`, `acp_adapter`, `acp_registry`, `docs` | None detected during inventory |
| OpenClaw | `openclaw-main (1).zip`; extracted `.reference-agent-labs/openclaw-main` | Archive + extracted directory | Yes, static only | TypeScript/Node monorepo with docs and apps | MIT via `LICENSE` and package metadata | `package.json`, `Dockerfile` | `packages/*`, `apps/*`, `docs/*`, `.agents/skills/*`, `security/*` | `packages/plugin-sdk`, `packages/plugin-package-contract`, `packages/sdk`, `docs/concepts`, `docs/gateway`, `docs/cli`, `security` | None detected during inventory |
| NVIDIA PersonaPlex | `personaplex-main.zip`; extracted `.reference-agent-labs/personaplex-main` | Archive + extracted directory | Yes, static only | Python speech server/model code, React/TypeScript client | Code MIT via `LICENSE-MIT`; README says model weights use NVIDIA Open Model License | `client/package.json`, `moshi/pyproject.toml`, `moshi/requirements.txt`, `Dockerfile` | `moshi/moshi/server.py`, `client/src/pages/Conversation`, `client/src/protocol`, `client/src/audio-processor.ts` | `moshi`, `client/src`, `assets` | None detected during inventory |

## Exact Files Inspected

Hermes Agent:

- `.reference-agent-labs/hermes-agent-main/README.md`
- `.reference-agent-labs/hermes-agent-main/LICENSE`
- `.reference-agent-labs/hermes-agent-main/package.json`
- `.reference-agent-labs/hermes-agent-main/pyproject.toml`
- `.reference-agent-labs/hermes-agent-main/agent/memory_manager.py`
- `.reference-agent-labs/hermes-agent-main/agent/skill_commands.py`
- `.reference-agent-labs/hermes-agent-main/agent/tool_guardrails.py`
- `.reference-agent-labs/hermes-agent-main/acp_adapter/permissions.py`
- Static grep/listing across `agent`, `tools`, `skills`, `gateway`, `cron`, and `acp_adapter`

OpenClaw:

- `.reference-agent-labs/openclaw-main/README.md`
- `.reference-agent-labs/openclaw-main/LICENSE`
- `.reference-agent-labs/openclaw-main/package.json`
- `.reference-agent-labs/openclaw-main/docs/concepts/agent-loop.md`
- Static grep/listing across `docs/concepts`, `docs/cli`, `docs/gateway`, `packages`, and `security`

PersonaPlex:

- `.reference-agent-labs/personaplex-main/README.md`
- `.reference-agent-labs/personaplex-main/LICENSE-MIT`
- `.reference-agent-labs/personaplex-main/client/package.json`
- `.reference-agent-labs/personaplex-main/client/src/protocol/types.ts`
- Static grep/listing across `client/src` and `moshi/moshi`

## Inspection Boundary

This was a local static architecture audit only. GORKH did not integrate, execute, install, or depend on Hermes, OpenClaw, PersonaPlex, NVIDIA Riva, Pipecat, or PersonaPlex runtime code.
