import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  connectorAccounts,
  connectorItems,
  connectorSyncRuns,
  type ConnectorAccount,
  type ConnectorItem,
  type ConnectorItemType,
  type ConnectorProvider,
  type Sensitivity,
} from "../db/schema.js";
import { assertNoRawToken, validateTokenRef } from "./oauth/token-vault.js";

export interface ImportedConnectorItem {
  provider: ConnectorProvider;
  itemType: ConnectorItemType;
  externalId: string;
  title?: string | null;
  summary?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  metadata?: Record<string, unknown>;
  sensitivity?: Sensitivity;
}

export async function listConnectorAccounts(userId: string): Promise<ConnectorAccount[]> {
  return db.select().from(connectorAccounts).where(eq(connectorAccounts.userId, userId)).orderBy(desc(connectorAccounts.updatedAt));
}

export async function getOwnedConnectorAccount(userId: string, accountId: string): Promise<ConnectorAccount | null> {
  const [account] = await db.select().from(connectorAccounts).where(and(eq(connectorAccounts.id, accountId), eq(connectorAccounts.userId, userId))).limit(1);
  return account ?? null;
}

export async function createFixtureConnectorAccount(args: { userId: string; provider: ConnectorProvider; accountEmail?: string | null; scopes: string[]; tokenRef?: string | null }): Promise<ConnectorAccount> {
  assertNoRawToken(args.tokenRef ?? "");
  const [account] = await db
    .insert(connectorAccounts)
    .values({
      userId: args.userId,
      provider: args.provider,
      accountEmail: args.accountEmail ?? null,
      status: args.tokenRef ? "connected" : "oauth_not_enabled",
      scopes: args.scopes,
      tokenRef: args.tokenRef ?? null,
    })
    .returning();
  if (!account) throw new Error("failed to create connector account");
  return account;
}

export async function disconnectConnectorAccount(userId: string, accountId: string): Promise<ConnectorAccount | null> {
  const [account] = await db
    .update(connectorAccounts)
    .set({ status: "disconnected", tokenRef: null, updatedAt: new Date() })
    .where(and(eq(connectorAccounts.id, accountId), eq(connectorAccounts.userId, userId)))
    .returning();
  return account ?? null;
}

export async function importConnectorItems(args: { userId: string; accountId: string; items: ImportedConnectorItem[] }): Promise<{ account: ConnectorAccount; items: ConnectorItem[] }> {
  const account = await getOwnedConnectorAccount(args.userId, args.accountId);
  if (!account) throw new Error("connector account not found");
  const token = validateTokenRef(account.tokenRef);
  if (!token.ok && account.status === "connected") throw new Error(token.reason ?? "token_missing");
  for (const item of args.items) assertNoRawToken(item);
  const inserted =
    args.items.length > 0
      ? await db
          .insert(connectorItems)
          .values(
            args.items.map((item) => ({
              userId: args.userId,
              connectorAccountId: account.id,
              provider: item.provider,
              itemType: item.itemType,
              externalId: item.externalId,
              title: item.title ?? null,
              summary: item.summary ?? null,
              startsAt: item.startsAt ? new Date(item.startsAt) : null,
              endsAt: item.endsAt ? new Date(item.endsAt) : null,
              metadata: item.metadata ?? {},
              sensitivity: item.sensitivity ?? "low",
            })),
          )
          .returning()
      : [];
  await db.insert(connectorSyncRuns).values({
    userId: args.userId,
    connectorAccountId: account.id,
    provider: account.provider,
    syncType: "fixture_import",
    status: "previewed",
    completedAt: new Date(),
    error: null,
    itemCounts: inserted.reduce<Record<string, number>>((counts, item) => {
      counts[item.itemType] = (counts[item.itemType] ?? 0) + 1;
      return counts;
    }, {}),
  });
  return { account, items: inserted };
}

export async function syncPreview(userId: string, accountId: string) {
  const account = await getOwnedConnectorAccount(userId, accountId);
  if (!account) return null;
  const token = validateTokenRef(account.tokenRef);
  if (!token.ok) {
    return {
      account,
      error: { code: token.reason ?? "token_missing", message: "Connector sync preview requires a connected account token reference. No fake connector data is returned." },
      items: [],
    };
  }
  const items = await db.select().from(connectorItems).where(and(eq(connectorItems.userId, userId), eq(connectorItems.connectorAccountId, accountId))).orderBy(desc(connectorItems.updatedAt)).limit(25);
  return { account, items, externalFetchPerformed: false };
}
