import { config } from "../../config.js";

export interface TokenVaultStatus {
  mode: "none" | "external_ref";
  rawTokenStorageAllowed: false;
  configured: boolean;
  reason?: string;
}

export function tokenVaultStatus(): TokenVaultStatus {
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
  const text = JSON.stringify(value ?? {});
  if (/(access_token|refresh_token|ya29\.|Bearer\s+)/i.test(text)) {
    throw new Error("raw connector tokens must not be stored, logged, or returned");
  }
}

export function validateTokenRef(tokenRef: string | null | undefined): { ok: boolean; reason?: string } {
  if (!tokenRef) return { ok: false, reason: "token_missing" };
  if (/access_token|refresh_token|ya29\.|Bearer\s+/i.test(tokenRef)) return { ok: false, reason: "raw_token_ref_rejected" };
  return { ok: true };
}
