import { SignJWT, jwtVerify } from "jose";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { config, requireKey } from "../../config.js";
import { db } from "../../db/client.js";
import { connectorAccounts, connectorItems, connectorSyncRuns, type ConnectorAccount, type ConnectorSyncStatus } from "../../db/schema.js";
import { createTokenVault } from "../../security/token-vault/provider.js";
import { GOOGLE_CALENDAR_EVENTS_READONLY_SCOPE, assertGoogleCalendarScopes } from "../oauth/google-scopes.js";
import { recordConnectorConsentEvent } from "../oauth/consent.js";
import { tokenVaultStatus } from "../oauth/token-vault.js";
import { exchangeGoogleCalendarCode, googleClientId, googleRedirectUri, listGoogleCalendarEvents, refreshGoogleAccessToken, requireGoogleOAuthConfig } from "./client.js";
import type { NormalizedGoogleCalendarItem } from "./normalize.js";

export function googleCalendarReadiness() {
  const missing: string[] = [];
  if (!config.GOOGLE_OAUTH_ENABLED) missing.push("GOOGLE_OAUTH_ENABLED=false");
  if (!config.GOOGLE_CALENDAR_READONLY_ENABLED) missing.push("GOOGLE_CALENDAR_READONLY_ENABLED=false");
  if (!(config.GOOGLE_CLIENT_ID || config.GOOGLE_OAUTH_CLIENT_ID)) missing.push("GOOGLE_CLIENT_ID");
  if (!(config.GOOGLE_CLIENT_SECRET || config.GOOGLE_OAUTH_CLIENT_SECRET)) missing.push("GOOGLE_CLIENT_SECRET");
  if (!(config.GOOGLE_OAUTH_REDIRECT_URI || config.GOOGLE_OAUTH_REDIRECT_BASE_URL)) missing.push("GOOGLE_OAUTH_REDIRECT_URI");
  const vault = tokenVaultStatus();
  if (!vault.configured) missing.push("TOKEN_VAULT_PROVIDER=encrypted_db");
  return {
    provider: "google_calendar" as const,
    enabled: missing.length === 0,
    scopes: [GOOGLE_CALENDAR_EVENTS_READONLY_SCOPE],
    missing,
    tokenVault: vault,
    readOnly: true,
    writesDisabled: true,
  };
}

export async function buildGoogleCalendarAuthUrl(userId: string): Promise<{ authorizationUrl?: string; readiness: ReturnType<typeof googleCalendarReadiness>; state?: string }> {
  const readiness = googleCalendarReadiness();
  if (!readiness.enabled) return { readiness };
  requireGoogleOAuthConfig();
  const scopes = assertGoogleCalendarScopes(readiness.scopes);
  const state = await signOAuthState({ userId, provider: "google_calendar", scopes, nonce: randomUUID() });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", googleClientId());
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return { readiness, authorizationUrl: url.toString(), state };
}

export async function completeGoogleCalendarOAuth(code: string, state: string): Promise<{ account: ConnectorAccount }> {
  const parsed = await verifyOAuthState(state);
  const scopes = assertGoogleCalendarScopes(parsed.scopes);
  const token = await exchangeGoogleCalendarCode(code);
  const tokenRef = await createTokenVault().store({ userId: parsed.userId, provider: "google_calendar", payload: token });
  const [account] = await db
    .insert(connectorAccounts)
    .values({
      userId: parsed.userId,
      provider: "google_calendar",
      accountEmail: token.accountEmail ?? null,
      status: "connected",
      scopes,
      tokenRef,
    })
    .returning();
  if (!account) throw new Error("failed to create Google Calendar connector account");
  await recordConnectorConsentEvent({ userId: parsed.userId, connectorAccountId: account.id, provider: "google_calendar", scopes, status: "accepted" }).catch(() => null);
  return { account };
}

export async function syncGoogleCalendarPreview(userId: string, accountId?: string | null) {
  const account = await getConnectedCalendarAccount(userId, accountId);
  if (!account) return { error: { code: "connector_not_connected", message: "Google Calendar account is not connected. No fake calendar data is returned." }, items: [] };
  const items = await fetchCalendarItems(userId, account);
  await recordSyncRun(userId, account.id, "preview", "previewed", null, items.length);
  return { account, items, persisted: false };
}

export async function syncGoogleCalendar(userId: string, accountId?: string | null) {
  const account = await getConnectedCalendarAccount(userId, accountId);
  if (!account) return { error: { code: "connector_not_connected", message: "Google Calendar account is not connected. No fake calendar data is returned." }, items: [] };
  const items = await fetchCalendarItems(userId, account);
  await db.delete(connectorItems).where(and(eq(connectorItems.userId, userId), eq(connectorItems.connectorAccountId, account.id), eq(connectorItems.provider, "google_calendar")));
  const inserted =
    items.length > 0
      ? await db
          .insert(connectorItems)
          .values(
            items.map((item) => ({
              userId,
              connectorAccountId: account.id,
              provider: item.provider,
              itemType: item.itemType,
              externalId: item.externalId,
              title: item.title,
              summary: item.summary,
              startsAt: item.startsAt ? new Date(item.startsAt) : null,
              endsAt: item.endsAt ? new Date(item.endsAt) : null,
              metadata: item.metadata,
              sensitivity: item.sensitivity,
            })),
          )
          .returning()
      : [];
  await recordSyncRun(userId, account.id, "sync", "completed", null, inserted.length);
  return { account, items: inserted, persisted: true };
}

export async function listStoredGoogleCalendarEvents(userId: string) {
  return db.select().from(connectorItems).where(and(eq(connectorItems.userId, userId), eq(connectorItems.provider, "google_calendar"), eq(connectorItems.itemType, "calendar_event"))).orderBy(desc(connectorItems.startsAt));
}

async function fetchCalendarItems(userId: string, account: ConnectorAccount): Promise<NormalizedGoogleCalendarItem[]> {
  if (!account.tokenRef) throw new Error("token_unavailable");
  const vault = createTokenVault();
  let token = await vault.get({ userId, tokenRef: account.tokenRef });
  const refreshed = await refreshGoogleAccessToken(token);
  if (refreshed.accessToken !== token.accessToken || refreshed.expiresAt !== token.expiresAt) {
    await vault.update({ userId, tokenRef: account.tokenRef, payload: refreshed });
    token = refreshed;
  }
  return listGoogleCalendarEvents(token);
}

async function getConnectedCalendarAccount(userId: string, accountId?: string | null): Promise<ConnectorAccount | null> {
  const where = accountId
    ? and(eq(connectorAccounts.id, accountId), eq(connectorAccounts.userId, userId), eq(connectorAccounts.provider, "google_calendar"), eq(connectorAccounts.status, "connected"))
    : and(eq(connectorAccounts.userId, userId), eq(connectorAccounts.provider, "google_calendar"), eq(connectorAccounts.status, "connected"));
  const [account] = await db.select().from(connectorAccounts).where(where).orderBy(desc(connectorAccounts.updatedAt)).limit(1);
  return account ?? null;
}

async function recordSyncRun(userId: string, accountId: string, syncType: string, status: ConnectorSyncStatus, error: string | null, eventCount: number): Promise<void> {
  await db.insert(connectorSyncRuns).values({
    userId,
    connectorAccountId: accountId,
    provider: "google_calendar",
    syncType,
    status,
    completedAt: new Date(),
    error,
    itemCounts: { calendar_event: eventCount },
  });
}

async function signOAuthState(payload: { userId: string; provider: string; scopes: string[]; nonce: string }): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(requireKey(config.JWT_SECRET, "JWT_SECRET")));
}

async function verifyOAuthState(state: string): Promise<{ userId: string; provider: "google_calendar"; scopes: string[]; nonce: string }> {
  const result = await jwtVerify(state, new TextEncoder().encode(requireKey(config.JWT_SECRET, "JWT_SECRET")));
  const payload = result.payload as { userId?: string; provider?: string; scopes?: unknown; nonce?: string };
  if (!payload.userId || payload.provider !== "google_calendar" || !Array.isArray(payload.scopes) || !payload.nonce) throw new Error("invalid_oauth_state");
  return { userId: payload.userId, provider: "google_calendar", scopes: payload.scopes.map(String), nonce: payload.nonce };
}
