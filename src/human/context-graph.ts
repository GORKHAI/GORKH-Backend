import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { contextEntities, type ContextEntityType, type Sensitivity } from "../db/schema.js";

export async function upsertContextEntity(args: {
  userId: string;
  entityType: ContextEntityType;
  name: string;
  description?: string | null;
  sensitivity?: Sensitivity;
  confidence?: number;
}) {
  const [existing] = await db
    .select()
    .from(contextEntities)
    .where(and(eq(contextEntities.userId, args.userId), eq(contextEntities.name, args.name)))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(contextEntities)
    .values({
      userId: args.userId,
      entityType: args.entityType,
      name: args.name,
      description: args.description ?? null,
      sensitivity: args.sensitivity ?? "low",
      confidence: args.confidence ?? 0.5,
    })
    .returning();
  if (!created) throw new Error("failed to create context entity");
  return created;
}

export async function listContextEntities(userId: string) {
  return db.select().from(contextEntities).where(eq(contextEntities.userId, userId));
}
