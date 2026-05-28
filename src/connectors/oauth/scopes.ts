import { z } from "zod";
import type { ConnectorId } from "../types.js";
import { GOOGLE_CALENDAR_EVENTS_READONLY_SCOPE } from "./google-scopes.js";

export const connectorScopeSchema = z.object({
  provider: z.string(),
  scope: z.string(),
  label: z.string(),
  riskLevel: z.enum(["low", "medium", "high"]),
  access: z.enum(["read_only", "draft_only", "write_requires_future_approval", "disabled"]),
  sensitive: z.boolean(),
  enabledInV0: z.boolean(),
});

export type ConnectorScope = z.infer<typeof connectorScopeSchema>;

export const scopeRegistry: Record<ConnectorId, ConnectorScope[]> = {
  google_calendar: [
    {
      provider: "google_calendar",
      scope: GOOGLE_CALENDAR_EVENTS_READONLY_SCOPE,
      label: "Read calendar events",
      riskLevel: "medium",
      access: "read_only",
      sensitive: true,
      enabledInV0: true,
    },
  ],
  google_gmail: [
    {
      provider: "google_gmail",
      scope: "https://www.googleapis.com/auth/gmail.metadata",
      label: "Read email metadata",
      riskLevel: "medium",
      access: "read_only",
      sensitive: true,
      enabledInV0: true,
    },
    {
      provider: "google_gmail",
      scope: "https://www.googleapis.com/auth/gmail.readonly",
      label: "Read email body",
      riskLevel: "high",
      access: "read_only",
      sensitive: true,
      enabledInV0: false,
    },
  ],
  microsoft_outlook: [],
  notion: [],
  slack: [],
  todoist: [],
  github: [],
  mcp_remote: [],
};

export function scopesForProvider(provider: ConnectorId): ConnectorScope[] {
  return scopeRegistry[provider] ?? [];
}

export function enabledScopeStrings(provider: ConnectorId): string[] {
  return scopesForProvider(provider)
    .filter((scope) => scope.enabledInV0)
    .map((scope) => scope.scope);
}

export function validateRequestedScopes(provider: ConnectorId, requested: string[]): { ok: boolean; denied: string[]; allowed: string[] } {
  const allowed = new Set(enabledScopeStrings(provider));
  const denied = requested.filter((scope) => !allowed.has(scope));
  return { ok: denied.length === 0, denied, allowed: requested.filter((scope) => allowed.has(scope)) };
}
