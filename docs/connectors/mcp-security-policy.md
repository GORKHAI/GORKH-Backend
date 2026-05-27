# MCP Security Policy

Remote MCP is disabled by default.

Blocked in v0:
- Remote MCP server connection.
- Stdio MCP server execution.
- Shell command spawning.
- Arbitrary tool invocation.
- Passing secrets or connector tokens to MCP tools.
- Private browser/session/cookie access.

Future MCP support must require registered manifests, validated schemas, explicit allowlists, user approval for write actions, and secret redaction before invocation.
