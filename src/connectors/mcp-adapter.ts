import { ConnectorPolicyError } from "./types.js";

export interface McpToolInvocationRequest {
  connectorId: "mcp_remote";
  toolName: string;
  input: unknown;
  manifestName?: string;
  approvalId?: string;
}

const secretPatterns = /(api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|cookie|password|secret|jwt)/i;

export function validateMcpInvocation(request: McpToolInvocationRequest): never {
  if (!request.toolName || /(?:^|[./\\])(sh|bash|zsh|cmd|powershell|node|python|tsx)(?:$|\s)/i.test(request.toolName)) {
    throw new ConnectorPolicyError("mcp_shell_disabled", "MCP stdio execution, shell spawning, and code execution are disabled.");
  }
  if (containsSecretKey(request.input)) {
    throw new ConnectorPolicyError("mcp_secret_exposure_blocked", "Secrets and tokens must not be passed to MCP tools.");
  }
  throw new ConnectorPolicyError(
    "mcp_disabled",
    "Remote MCP servers, stdio server execution, shell spawning, arbitrary MCP tool invocation, and private browser/session access are disabled in v0.",
  );
}

function containsSecretKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => containsSecretKey(item));
  return Object.entries(value as Record<string, unknown>).some(([key, nested]) => secretPatterns.test(key) || containsSecretKey(nested));
}
