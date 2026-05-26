import { ConnectorPolicyError } from "./types.js";

export function requireOAuthConfigured(connectorId: string): never {
  throw new ConnectorPolicyError("connector_not_configured", `${connectorId} OAuth is not configured in v0`);
}
