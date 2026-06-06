import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { accountAuditEvents, accountDeletionRequests, authAccounts, userPlans, users } from "../db/schema.js";
import { verifyUserToken } from "./jwt.js";
import { billingStatus, getOrCreateUserPlan, publicPlan } from "./plans.js";
import { revokeAuthSession } from "./sessions.js";
import { authError } from "./auth-errors.js";

type RequireAuth = (request: FastifyRequest, reply: FastifyReply) => Promise<string | null>;

const deletionBody = z.object({
  reason: z.string().max(1000).nullable().optional(),
});

export function registerAccountRoutes(app: FastifyInstance, requireAuth: RequireAuth) {
  app.get("/account/me", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    return reply.send(await getAccountProfile(userId));
  });

  app.post("/account/sign-out", async (request, reply) => {
    const auth = await parseAuth(request);
    if (!auth) return reply.code(401).send(authError("auth_missing", "Missing bearer token."));
    const revoked = await revokeAuthSession(auth.userId, auth.tokenId);
    await auditAccountEvent(auth.userId, "account_signed_out", { sessionRevoked: Boolean(revoked) });
    return reply.send({ ok: true, sessionRevoked: Boolean(revoked), clientClearRequired: !revoked });
  });

  app.post("/account/delete-request", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    if (!config.ACCOUNT_DELETION_ENABLED || config.ACCOUNT_DELETION_MODE !== "request") {
      return reply.code(403).send(authError("account_deletion_not_enabled", "Account deletion requests are not enabled."));
    }
    const body = deletionBody.parse(request.body ?? {});
    const [row] = await db
      .insert(accountDeletionRequests)
      .values({ userId, status: "requested", reason: body.reason ?? null })
      .returning();
    await auditAccountEvent(userId, "account_deletion_requested", { deletionRequestId: row?.id ?? null });
    return reply.send({
      deletionRequest: row,
      message: "Your account deletion request has been recorded.",
    });
  });

  app.post("/account/delete-cancel", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const [row] = await db
      .update(accountDeletionRequests)
      .set({ status: "canceled" })
      .where(and(eq(accountDeletionRequests.userId, userId), eq(accountDeletionRequests.status, "requested")))
      .returning();
    await auditAccountEvent(userId, "account_deletion_canceled", { deletionRequestId: row?.id ?? null });
    return reply.send({ deletionRequest: row ?? null, message: row ? "Account deletion request canceled." : "No pending deletion request was found." });
  });

  app.get("/plans/me", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    return reply.send({ plan: publicPlan(await getOrCreateUserPlan(userId)) });
  });

  app.get("/billing/status", async (_, reply) => reply.send(billingStatus()));
}

export async function getAccountProfile(userId: string) {
  const [[user], accounts, plan, [deletion]] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    db.select().from(authAccounts).where(eq(authAccounts.userId, userId)),
    getOrCreateUserPlan(userId),
    db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.userId, userId))
      .orderBy(desc(accountDeletionRequests.requestedAt))
      .limit(1),
  ]);
  if (!user) throw new Error("account user not found");
  return {
    account: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      providers: accounts.map((account) => ({
        provider: account.provider,
        email: account.email,
        emailVerified: account.emailVerified,
        displayName: account.displayName,
        createdAt: account.createdAt.toISOString(),
      })),
      plan: publicPlan(plan),
      deletionStatus: deletion?.status ?? null,
      createdAt: user.createdAt.toISOString(),
    },
  };
}

export async function auditAccountEvent(userId: string | null, eventType: string, payload: Record<string, unknown>) {
  const [row] = await db.insert(accountAuditEvents).values({ userId, eventType, payload }).returning();
  return row;
}

export async function accountMobileSyncItems(userId: string, since: Date, limit: number) {
  const [audits, [plan], deletions] = await Promise.all([
    db
      .select()
      .from(accountAuditEvents)
      .where(and(eq(accountAuditEvents.userId, userId), gt(accountAuditEvents.createdAt, since)))
      .orderBy(desc(accountAuditEvents.createdAt))
      .limit(limit),
    db.select().from(userPlans).where(eq(userPlans.userId, userId)).limit(1),
    db
      .select()
      .from(accountDeletionRequests)
      .where(and(eq(accountDeletionRequests.userId, userId), gt(accountDeletionRequests.requestedAt, since)))
      .orderBy(desc(accountDeletionRequests.requestedAt))
      .limit(limit),
  ]);
  const planItem = plan
    ? [{ type: "plan_status", createdAt: plan.updatedAt, item: publicPlan(plan) }]
    : [];
  return [
    ...audits.map((item) => ({ type: "account_status", createdAt: item.createdAt, item: { eventType: item.eventType, payload: item.payload, createdAt: item.createdAt } })),
    ...planItem,
    ...deletions.map((item) => ({ type: "deletion_request_status", createdAt: item.requestedAt, item })),
  ];
}

async function parseAuth(request: FastifyRequest) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
  if (!token) return null;
  try {
    return await verifyUserToken(token);
  } catch {
    return null;
  }
}
