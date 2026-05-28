import type { ConnectorTokenPayload, TokenVault } from "./types.js";
import { TokenVaultError } from "./types.js";

export class NoneTokenVault implements TokenVault {
  readonly name = "none" as const;

  async store(): Promise<string> {
    throw new TokenVaultError("token_vault_not_configured", "Token vault is disabled.");
  }

  async get(): Promise<ConnectorTokenPayload> {
    throw new TokenVaultError("token_vault_not_configured", "Token vault is disabled.");
  }

  async update(): Promise<void> {
    throw new TokenVaultError("token_vault_not_configured", "Token vault is disabled.");
  }

  async delete(): Promise<void> {
    return;
  }
}
