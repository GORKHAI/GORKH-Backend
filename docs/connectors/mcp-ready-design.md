# MCP-Ready Design v0

GORKH can model MCP connector manifests, but it does not execute MCP servers or arbitrary MCP tools in v0.

## Disabled By Default

- remote MCP server access
- stdio MCP server execution
- shell command spawning
- arbitrary tool invocation
- network access through unregistered MCP tools

## Future Activation Requirements

A future MCP connector must provide:

- a registered manifest
- exact tool names
- input/output schemas
- risk level
- permission mapping
- approval requirements
- audit logging
- timeout and cancellation behavior

Read-only tools may become allowlisted later, but only after manifest review. Write or external-action tools must require explicit user approval.
