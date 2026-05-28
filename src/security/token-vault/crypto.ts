import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { config } from "../../config.js";
import { TokenVaultError } from "./types.js";

const VERSION = "v1";

export function assertNoRawTokenText(value: unknown): void {
  const text = JSON.stringify(value ?? {});
  if (/(access_token|refresh_token|accessToken|refreshToken|ya29\.|Bearer\s+)/i.test(text)) {
    throw new TokenVaultError("raw_token_rejected", "Raw connector tokens must not be stored, logged, or returned outside the token vault.");
  }
}

export function encryptionKey(): Buffer {
  const raw = config.TOKEN_VAULT_ENCRYPTION_KEY;
  if (!raw) throw new TokenVaultError("token_vault_not_configured", "TOKEN_VAULT_ENCRYPTION_KEY is required for encrypted_db token vault.");
  const trimmed = raw.trim();
  const key = /^[0-9a-f]{64}$/i.test(trimmed) ? Buffer.from(trimmed, "hex") : Buffer.from(trimmed, "base64");
  if (key.length !== 32) throw new TokenVaultError("token_encryption_key_invalid", "TOKEN_VAULT_ENCRYPTION_KEY must decode to 32 bytes.");
  return key;
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, config.TOKEN_VAULT_KEY_ID, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptJson<T>(encryptedPayload: string): T {
  const [version, , ivText, tagText, encryptedText] = encryptedPayload.split(".");
  if (version !== VERSION || !ivText || !tagText || !encryptedText) throw new TokenVaultError("token_unavailable", "Encrypted token payload is malformed.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}
