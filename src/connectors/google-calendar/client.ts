import { config, requireKey } from "../../config.js";
import type { ConnectorTokenPayload } from "../../security/token-vault/types.js";
import { TokenVaultError } from "../../security/token-vault/types.js";
import { normalizeGoogleCalendarEvent, type GoogleCalendarEventInput } from "./normalize.js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export async function exchangeGoogleCalendarCode(code: string): Promise<ConnectorTokenPayload> {
  requireGoogleOAuthConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw new TokenVaultError("token_unavailable", `google_token_exchange_failed:${response.status}`);
  const body = (await response.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; token_type?: string };
  if (!body.access_token) throw new TokenVaultError("token_unavailable", "google_token_exchange_missing_access_token");
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: body.expires_in ? new Date(Date.now() + body.expires_in * 1000).toISOString() : undefined,
    scope: body.scope,
    tokenType: body.token_type,
  };
}

export async function refreshGoogleAccessToken(payload: ConnectorTokenPayload): Promise<ConnectorTokenPayload> {
  requireGoogleOAuthConfig();
  if (!payload.refreshToken) return payload;
  if (payload.expiresAt && new Date(payload.expiresAt).getTime() > Date.now() + 60_000) return payload;
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: payload.refreshToken,
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new TokenVaultError("token_unavailable", `google_token_refresh_failed:${response.status}`);
  const body = (await response.json()) as { access_token?: string; expires_in?: number; scope?: string; token_type?: string };
  if (!body.access_token) throw new TokenVaultError("token_unavailable", "google_token_refresh_missing_access_token");
  return {
    ...payload,
    accessToken: body.access_token,
    expiresAt: body.expires_in ? new Date(Date.now() + body.expires_in * 1000).toISOString() : payload.expiresAt,
    scope: body.scope ?? payload.scope,
    tokenType: body.token_type ?? payload.tokenType,
  };
}

export async function listGoogleCalendarEvents(payload: ConnectorTokenPayload, window?: { timeMin?: Date; timeMax?: Date }) {
  const now = new Date();
  const timeMin = window?.timeMin ?? new Date(now.getTime() - 7 * 86_400_000);
  const timeMax = window?.timeMax ?? new Date(now.getTime() + 30 * 86_400_000);
  const url = new URL(GOOGLE_EVENTS_URL);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("timeMin", timeMin.toISOString());
  url.searchParams.set("timeMax", timeMax.toISOString());
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${payload.accessToken}`, Accept: "application/json" },
  });
  if (!response.ok) throw new TokenVaultError("token_unavailable", `google_calendar_list_failed:${response.status}`);
  const body = (await response.json()) as { items?: GoogleCalendarEventInput[] };
  return (body.items ?? []).map(normalizeGoogleCalendarEvent);
}

export function requireGoogleOAuthConfig(): void {
  if (!config.GOOGLE_OAUTH_ENABLED || !config.GOOGLE_CALENDAR_READONLY_ENABLED) throw new TokenVaultError("token_vault_not_configured", "Google Calendar OAuth is not enabled.");
  if (!(config.GOOGLE_CLIENT_ID || config.GOOGLE_OAUTH_CLIENT_ID)) throw new TokenVaultError("token_vault_not_configured", "GOOGLE_CLIENT_ID is required.");
  if (!(config.GOOGLE_CLIENT_SECRET || config.GOOGLE_OAUTH_CLIENT_SECRET)) throw new TokenVaultError("token_vault_not_configured", "GOOGLE_CLIENT_SECRET is required.");
  if (!(config.GOOGLE_OAUTH_REDIRECT_URI || config.GOOGLE_OAUTH_REDIRECT_BASE_URL)) throw new TokenVaultError("token_vault_not_configured", "GOOGLE_OAUTH_REDIRECT_URI is required.");
}

export function googleClientId(): string {
  return requireKey(config.GOOGLE_CLIENT_ID || config.GOOGLE_OAUTH_CLIENT_ID, "GOOGLE_CLIENT_ID");
}

export function googleClientSecret(): string {
  return requireKey(config.GOOGLE_CLIENT_SECRET || config.GOOGLE_OAUTH_CLIENT_SECRET, "GOOGLE_CLIENT_SECRET");
}

export function googleRedirectUri(): string {
  return config.GOOGLE_OAUTH_REDIRECT_URI || `${config.GOOGLE_OAUTH_REDIRECT_BASE_URL}/connectors/oauth/google-calendar/callback`;
}
