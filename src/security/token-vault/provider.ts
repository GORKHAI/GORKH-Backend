import { config } from "../../config.js";
import { EncryptedDbTokenVault } from "./encrypted-db-vault.js";
import { encryptionKey } from "./crypto.js";
import { NoneTokenVault } from "./none.js";
import type { TokenVault } from "./types.js";

export function createTokenVault(): TokenVault {
  if (config.TOKEN_VAULT_PROVIDER === "encrypted_db") {
    encryptionKey();
    return new EncryptedDbTokenVault();
  }
  return new NoneTokenVault();
}

export function tokenVaultRuntimeStatus() {
  if (config.TOKEN_VAULT_PROVIDER === "encrypted_db") {
    try {
      encryptionKey();
      return {
        provider: "encrypted_db" as const,
        configured: true,
        rawTokenStorageAllowed: false,
        keyId: config.TOKEN_VAULT_KEY_ID,
      };
    } catch (err) {
      return {
        provider: "encrypted_db" as const,
        configured: false,
        rawTokenStorageAllowed: false,
        keyId: config.TOKEN_VAULT_KEY_ID,
        error: (err as Error).message,
      };
    }
  }
  return {
    provider: "none" as const,
    configured: false,
    rawTokenStorageAllowed: false,
    reason: "Token vault is disabled.",
  };
}
