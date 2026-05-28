import { and, eq } from "drizzle-orm";
import { config } from "../../config.js";
import { db } from "../../db/client.js";
import { connectorTokenVault } from "../../db/schema.js";
import type { ConnectorProvider } from "../../db/schema.js";
import { decryptJson, encryptJson } from "./crypto.js";
import type { ConnectorTokenPayload, TokenVault } from "./types.js";
import { TokenVaultError } from "./types.js";

export class EncryptedDbTokenVault implements TokenVault {
  readonly name = "encrypted_db" as const;

  async store(params: { userId: string; provider: ConnectorProvider; payload: ConnectorTokenPayload }): Promise<string> {
    const [row] = await db
      .insert(connectorTokenVault)
      .values({
        userId: params.userId,
        provider: params.provider,
        keyId: config.TOKEN_VAULT_KEY_ID,
        encryptedPayload: encryptJson(params.payload),
      })
      .returning();
    if (!row) throw new TokenVaultError("token_unavailable", "Failed to store connector token.");
    return `vault:${row.id}`;
  }

  async get(params: { userId: string; tokenRef: string }): Promise<ConnectorTokenPayload> {
    const id = parseTokenRef(params.tokenRef);
    const [row] = await db.select().from(connectorTokenVault).where(and(eq(connectorTokenVault.id, id), eq(connectorTokenVault.userId, params.userId))).limit(1);
    if (!row) throw new TokenVaultError("token_unavailable", "Connector token is unavailable.");
    return decryptJson<ConnectorTokenPayload>(row.encryptedPayload);
  }

  async update(params: { userId: string; tokenRef: string; payload: ConnectorTokenPayload }): Promise<void> {
    const id = parseTokenRef(params.tokenRef);
    await db
      .update(connectorTokenVault)
      .set({ keyId: config.TOKEN_VAULT_KEY_ID, encryptedPayload: encryptJson(params.payload), updatedAt: new Date() })
      .where(and(eq(connectorTokenVault.id, id), eq(connectorTokenVault.userId, params.userId)));
  }

  async delete(params: { userId: string; tokenRef: string }): Promise<void> {
    const id = parseTokenRef(params.tokenRef);
    await db.delete(connectorTokenVault).where(and(eq(connectorTokenVault.id, id), eq(connectorTokenVault.userId, params.userId)));
  }
}

function parseTokenRef(tokenRef: string): string {
  if (!tokenRef.startsWith("vault:")) throw new TokenVaultError("token_unavailable", "Token reference is not managed by encrypted_db vault.");
  return tokenRef.slice("vault:".length);
}
