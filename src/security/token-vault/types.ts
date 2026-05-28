import type { ConnectorProvider } from "../../db/schema.js";

export interface ConnectorTokenPayload {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scope?: string;
  tokenType?: string;
  accountEmail?: string | null;
}

export interface TokenVault {
  readonly name: "none" | "encrypted_db";
  store(params: { userId: string; provider: ConnectorProvider; payload: ConnectorTokenPayload }): Promise<string>;
  get(params: { userId: string; tokenRef: string }): Promise<ConnectorTokenPayload>;
  update(params: { userId: string; tokenRef: string; payload: ConnectorTokenPayload }): Promise<void>;
  delete(params: { userId: string; tokenRef: string }): Promise<void>;
}

export class TokenVaultError extends Error {
  constructor(
    readonly code: "token_vault_not_configured" | "token_unavailable" | "token_encryption_key_invalid" | "raw_token_rejected",
    message: string,
  ) {
    super(message);
  }
}
