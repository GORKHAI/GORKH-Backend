import type { ConnectorManifest } from "./types.js";

export const disabledConnectorCapabilities = [
  "send_email",
  "create_or_cancel_meeting",
  "submit_form",
  "payment",
  "browser_login",
  "stdio_mcp_server_execution",
  "arbitrary_mcp_tool_invocation",
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
