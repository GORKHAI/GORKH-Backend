import { config } from "../../config.js";
import { assertNoRawTokenText } from "../../security/token-vault/crypto.js";
import { tokenVaultRuntimeStatus } from "../../security/token-vault/provider.js";

export interface TokenVaultStatus {
  mode: "none" | "external_ref" | "encrypted_db";
  rawTokenStorageAllowed: false;
  configured: boolean;
  reason?: string;
  keyId?: string;
  error?: string;
}

export function tokenVaultStatus(): TokenVaultStatus {
  if (config.TOKEN_VAULT_PROVIDER === "encrypted_db") {
    const status = tokenVaultRuntimeStatus();
    return {
      mode: "encrypted_db",
      rawTokenStorageAllowed: false,
      configured: status.configured,
      keyId: status.keyId,
      reason: "Encrypted DB token vault stores only authenticated encrypted token material.",
      error: "error" in status ? status.error : undefined,
    };
  }
  if (config.CONNECTOR_TOKEN_VAULT === "external_ref") {
    return { mode: "external_ref", rawTokenStorageAllowed: false, configured: true };
  }
  return {
    mode: "none",
    rawTokenStorageAllowed: false,
    configured: false,
    reason: "No production token vault is configured. OAuth can be inspected, but live account connection is disabled.",
  };
}

export function assertNoRawToken(value: unknown): void {
  assertNoRawTokenText(value);
}

export function validateTokenRef(tokenRef: string | null | undefined): { ok: boolean; reason?: string } {
  if (!tokenRef) return { ok: false, reason: "token_missing" };
  if (/access_token|refresh_token|accessToken|refreshToken|ya29\.|Bearer\s+/i.test(tokenRef)) return { ok: false, reason: "raw_token_ref_rejected" };
  if (tokenRef.startsWith("vault:") && config.TOKEN_VAULT_PROVIDER !== "encrypted_db") return { ok: false, reason: "token_vault_not_configured" };
  return { ok: true };
}
