import type { ConnectorManifest } from "./types.js";

export const disabledConnectorCapabilities = [
  "send_email",
  "create_or_cancel_meeting",
  "submit_form",
  "payment",
  "browser_login",
  "private_browser_session_access",
  "stdio_mcp_server_execution",
  "shell_command_mcp_server",
  "arbitrary_mcp_tool_invocation",
  "connector_token_frontend_exposure",
];

export function connectorPermissionSummary(manifest: ConnectorManifest) {
  return {
    connectorId: manifest.id,
    enabled: manifest.enabled,
    configured: manifest.configured,
    permissions: manifest.permissions,
    disabledReason: manifest.disabledReason,
    disabledCapabilities: disabledConnectorCapabilities,
    approvalRequired: manifest.permissions.filter((permission) => /requires_approval|requires_manifest/.test(permission)),
  };
}
