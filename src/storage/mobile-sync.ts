import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "../db/client.js";
import { storageEvents, storageUsage } from "../db/schema.js";
import { publicStorageUsage } from "./usage.js";

export async function storageMobileSyncItems(userId: string, since: Date, limit: number) {
  const [events, [usage]] = await Promise.all([
    db.select().from(storageEvents).where(and(eq(storageEvents.userId, userId), gt(storageEvents.createdAt, since))).orderBy(desc(storageEvents.createdAt)).limit(limit),
    db.select().from(storageUsage).where(eq(storageUsage.userId, userId)).limit(1),
  ]);
  const usageItems = usage && usage.updatedAt > since ? [{ type: "storage_usage_updated", createdAt: usage.updatedAt, item: publicStorageUsage(usage) }] : [];
  return [
    ...usageItems,
    ...events.map((event) => ({
      type: event.eventType === "export_completed" ? "export_ready" : "storage_event",
      createdAt: event.createdAt,
      item: { id: event.id, objectId: event.objectId, eventType: event.eventType, payload: event.payload, createdAt: event.createdAt },
    })),
  ];
}

