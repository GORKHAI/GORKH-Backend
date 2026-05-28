import { config } from "../../config.js";
import type { ConnectorId } from "../types.js";
import { googleCalendarReadiness } from "../google-calendar/sync.js";
import { enabledScopeStrings } from "./scopes.js";
import { tokenVaultStatus } from "./token-vault.js";

export function oauthReadiness(provider: ConnectorId) {
  if (provider === "google_calendar") return googleCalendarReadiness();
  const supported = provider === "google_gmail";
  const scopes = enabledScopeStrings(provider);
  const missing: string[] = [];
  if (!supported) missing.push("provider_oauth_not_supported");
  if (!config.GOOGLE_OAUTH_ENABLED) missing.push("GOOGLE_OAUTH_ENABLED=false");
  if (!config.GOOGLE_OAUTH_CLIENT_ID) missing.push("GOOGLE_OAUTH_CLIENT_ID");
  if (!config.GOOGLE_OAUTH_CLIENT_SECRET) missing.push("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!config.GOOGLE_OAUTH_REDIRECT_BASE_URL) missing.push("GOOGLE_OAUTH_REDIRECT_BASE_URL");
  const vault = tokenVaultStatus();
  if (!vault.configured) missing.push("CONNECTOR_TOKEN_VAULT");
  return {
    provider,
    supported,
    enabled: missing.length === 0,
    scopes,
    tokenVault: vault,
    missing,
    externalWritesDisabled: true,
  };
}

export function oauthNotEnabledResponse(provider: ConnectorId) {
  const readiness = oauthReadiness(provider);
  return {
    error: {
      code: "oauth_not_enabled",
      message: "OAuth live connection is readiness-only until Google OAuth env and a safe token vault are configured.",
      missing: readiness.missing,
    },
    readiness,
  };
}
