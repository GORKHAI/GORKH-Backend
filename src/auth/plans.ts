import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { userPlans, type UserPlan } from "../db/schema.js";

export async function getOrCreateUserPlan(userId: string): Promise<UserPlan> {
  const [existing] = await db.select().from(userPlans).where(eq(userPlans.userId, userId)).limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(userPlans)
    .values({
      userId,
      planCode: config.PLAN_DEFAULT,
      status: config.BILLING_ENABLED ? "active" : "billing_not_enabled",
      source: "system",
      billingEnabled: config.BILLING_ENABLED,
    })
    .returning();
  if (!created) throw new Error("failed to create default user plan");
  return created;
}

export function publicPlan(plan: UserPlan) {
  return {
    planCode: plan.planCode,
    status: plan.status,
    billingEnabled: plan.billingEnabled,
    source: plan.source,
    currentPeriodEnd: plan.currentPeriodEnd?.toISOString() ?? null,
    displayName: plan.planCode === "internal_alpha" ? "Internal Alpha" : plan.planCode,
    message: plan.billingEnabled ? "Billing is active for this plan." : "Billing is not enabled in this alpha.",
  };
}

export function billingStatus() {
  return {
    billingEnabled: config.BILLING_ENABLED,
    provider: "none",
    message: "Billing is not enabled in this alpha.",
  };
}
