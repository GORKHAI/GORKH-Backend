import { createHash, randomBytes } from "node:crypto";

export function createInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function roomGuestUrl(baseUrl: string | undefined, token: string): string {
  const base = (baseUrl ?? "").replace(/\/$/, "");
  return base ? `${base}/r/${encodeURIComponent(token)}` : `/r/${encodeURIComponent(token)}`;
}
