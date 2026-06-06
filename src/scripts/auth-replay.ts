import { eq } from "drizzle-orm";
import { buildServer } from "../server.js";
import { closeDb, db } from "../db/client.js";
import { authAccounts, users } from "../db/schema.js";
import { signUserToken } from "../auth/jwt.js";
import { createAuthSession } from "../auth/sessions.js";

type AuthReplayName = "apple-disabled" | "email-disabled" | "account-me" | "plan-status" | "delete-request" | "sign-out";

export const authReplayScenarios: AuthReplayName[] = ["apple-disabled", "email-disabled", "account-me", "plan-status", "delete-request", "sign-out"];

async function main() {
  const name = (process.argv[2] ?? "apple-disabled") as AuthReplayName;
  if (!authReplayScenarios.includes(name)) throw new Error(`unknown auth replay "${name}"`);
  await runAuthReplay(name);
}

export async function runAuthReplay(name: AuthReplayName) {
  const app = await buildServer();
  try {
    if (name === "apple-disabled") {
      const response = await app.inject({ method: "POST", url: "/auth/apple/verify", payload: { identityToken: "redacted" } });
      assertStatus(response.statusCode, 501, name);
      assertCode(response.json(), "apple_sign_in_not_enabled");
      console.log("auth apple-disabled: passed");
      return;
    }
    if (name === "email-disabled") {
      const response = await app.inject({ method: "POST", url: "/auth/email/start", payload: { email: "auth-replay@example.com" } });
      assertStatus(response.statusCode, 501, name);
      assertCode(response.json(), "email_auth_not_enabled");
      console.log("auth email-disabled: passed");
      return;
    }

    const user = await getReplayUser();
    const token = await signUserToken(user.id);
    const headers = { Authorization: `Bearer ${token}` };

    if (name === "account-me") {
      const response = await app.inject({ method: "GET", url: "/account/me", headers });
      assertStatus(response.statusCode, 200, name);
      const body = response.json();
      if (body.account?.id !== user.id || JSON.stringify(body).includes(token)) throw new Error("account-me response unsafe or invalid");
      console.log("auth account-me: passed");
      return;
    }
    if (name === "plan-status") {
      const response = await app.inject({ method: "GET", url: "/plans/me", headers });
      assertStatus(response.statusCode, 200, name);
      const body = response.json();
      if (body.plan?.planCode !== "internal_alpha" || body.plan?.billingEnabled !== false) throw new Error("plan status invalid");
      const billing = await app.inject({ method: "GET", url: "/billing/status" });
      assertStatus(billing.statusCode, 200, "billing-status");
      if (billing.json().billingEnabled !== false) throw new Error("billing unexpectedly enabled");
      console.log("auth plan-status: passed");
      return;
    }
    if (name === "delete-request") {
      const response = await app.inject({ method: "POST", url: "/account/delete-request", headers, payload: { reason: "Replay validation." } });
      assertStatus(response.statusCode, 200, name);
      if (response.json().deletionRequest?.status !== "requested") throw new Error("deletion request not recorded");
      console.log("auth delete-request: passed");
      return;
    }
    if (name === "sign-out") {
      const session = await createAuthSession({ userId: user.id, deviceLabel: "Replay", platform: "ios" });
      const response = await app.inject({ method: "POST", url: "/account/sign-out", headers: { Authorization: `Bearer ${session.token}` } });
      assertStatus(response.statusCode, 200, name);
      if (response.json().sessionRevoked !== true) throw new Error("session was not revoked");
      console.log("auth sign-out: passed");
    }
  } finally {
    await app.close();
  }
}

async function getReplayUser() {
  const email = "auth-replay@gorkh.dev";
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return existing;
  const [user] = await db.insert(users).values({ email, displayName: "Auth Replay" }).returning();
  if (!user) throw new Error("failed to create auth replay user");
  await db
    .insert(authAccounts)
    .values({ userId: user.id, provider: "dev", providerSubject: `dev:${user.id}`, email, emailVerified: true, displayName: "Auth Replay" })
    .onConflictDoNothing();
  return user;
}

function assertStatus(actual: number, expected: number, label: string) {
  if (actual !== expected) throw new Error(`${label} returned ${actual}, expected ${expected}`);
}

function assertCode(body: unknown, code: string) {
  const actual = (body as { error?: { code?: string } }).error?.code;
  if (actual !== code) throw new Error(`expected error code ${code}, received ${actual ?? "missing"}`);
}

if (process.argv[1]?.endsWith("auth-replay.ts") || process.argv[1]?.endsWith("auth-replay.js")) {
  main()
    .catch((err) => {
      console.error(`auth:replay failed: ${(err as Error).message}`);
      process.exit(1);
    })
    .finally(async () => {
      await closeDb().catch(() => undefined);
    });
}
