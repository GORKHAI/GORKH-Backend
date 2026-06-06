import type { FastifyInstance } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { authAccounts, users } from "../db/schema.js";
import { authDisabledError, authError } from "./auth-errors.js";
import { auditAccountEvent, getAccountProfile } from "./account.js";
import { getOrCreateUserPlan } from "./plans.js";
import { createAuthSession } from "./sessions.js";

const appleVerifyBody = z.object({
  identityToken: z.string().min(1),
  authorizationCode: z.string().min(1).nullable().optional(),
  fullName: z.string().min(1).nullable().optional(),
  email: z.string().email().nullable().optional(),
  deviceLabel: z.string().min(1).max(120).nullable().optional(),
});

const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export function registerAppleAuthRoutes(app: FastifyInstance) {
  app.post("/auth/apple/verify", async (request, reply) => {
    if (!config.APPLE_SIGN_IN_ENABLED) return reply.code(501).send(authDisabledError("apple"));
    const body = appleVerifyBody.parse(request.body ?? {});
    try {
      const { payload } = await jwtVerify(body.identityToken, appleJwks, {
        issuer: "https://appleid.apple.com",
        audience: config.APPLE_ALLOWED_AUDIENCES.split(",").map((value) => value.trim()).filter(Boolean),
      });
      const providerSubject = payload.sub;
      if (!providerSubject) return reply.code(400).send(authError("apple_identity_invalid", "Apple identity token is missing subject."));
      const email = typeof payload.email === "string" ? payload.email : body.email ?? `apple-${providerSubject}@apple.local`;
      const emailVerified = payload.email_verified === true || payload.email_verified === "true";
      const [existingAccount] = await db.select().from(authAccounts).where(and(eq(authAccounts.provider, "apple"), eq(authAccounts.providerSubject, providerSubject))).limit(1);
      let userId = existingAccount?.userId;
      if (!userId) {
        const [user] = await db
          .insert(users)
          .values({ email, displayName: body.fullName ?? null })
          .onConflictDoUpdate({ target: users.email, set: { displayName: body.fullName ?? null } })
          .returning();
        if (!user) throw new Error("failed to create Apple auth user");
        userId = user.id;
        await db
          .insert(authAccounts)
          .values({
            userId,
            provider: "apple",
            providerSubject,
            email,
            emailVerified,
            displayName: body.fullName ?? null,
          })
          .onConflictDoNothing()
          .returning();
      }
      await getOrCreateUserPlan(userId);
      const session = await createAuthSession({ userId, deviceLabel: body.deviceLabel ?? null, platform: "ios" });
      await auditAccountEvent(userId, "apple_sign_in", { provider: "apple" });
      return reply.send({
        token: session.token,
        expiresAt: session.expiresAt.toISOString(),
        account: (await getAccountProfile(userId)).account,
      });
    } catch {
      return reply.code(401).send(authError("apple_identity_invalid", "Apple identity token could not be verified."));
    }
  });
}
