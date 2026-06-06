import { and, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { authSessions } from "../db/schema.js";
import { signUserToken } from "./jwt.js";

export async function createAuthSession(args: { userId: string; deviceLabel?: string | null; platform?: string | null }) {
  const tokenId = randomUUID();
  const expiresAt = new Date(Date.now() + config.AUTH_JWT_TTL_SECONDS * 1000);
  const [session] = await db
    .insert(authSessions)
    .values({
      userId: args.userId,
      tokenId,
      deviceLabel: args.deviceLabel ?? null,
      platform: args.platform ?? null,
      expiresAt,
    })
    .returning();
  if (!session) throw new Error("failed to create auth session");
  const token = await signUserToken(args.userId, `${config.AUTH_JWT_TTL_SECONDS}s`, tokenId);
  return { session, token, expiresAt };
}

export async function revokeAuthSession(userId: string, tokenId?: string | null) {
  if (!tokenId) return null;
  const [session] = await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(authSessions.userId, userId), eq(authSessions.tokenId, tokenId), isNull(authSessions.revokedAt)))
    .returning();
  return session ?? null;
}
