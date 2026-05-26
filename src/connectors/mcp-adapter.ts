import { ConnectorPolicyError } from "./types.js";

export interface McpToolInvocationRequest {
  connectorId: "mcp_remote";
  toolName: string;
  input: unknown;
}

export function validateMcpInvocation(_: McpToolInvocationRequest): never {
  throw new ConnectorPolicyError(
    "mcp_disabled",
    "Remote MCP servers, stdio server execution, shell spawning, and arbitrary MCP tool invocation are disabled in v0.",
  );
}
