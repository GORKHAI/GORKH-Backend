import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { storageObjects, storageUsage, type StorageUsage as StorageUsageRow } from "../db/schema.js";
import type { PublicStorageUsage } from "./types.js";

export async function recalculateStorageUsage(userId: string): Promise<PublicStorageUsage> {
  const [totals] = await db
    .select({
      totalBytes: sql<string>`coalesce(sum(coalesce(${storageObjects.sizeBytes}, 0)), 0)`,
      transcriptBytes: sql<string>`coalesce(sum(case when ${storageObjects.objectType} = 'transcript' then coalesce(${storageObjects.sizeBytes}, 0) else 0 end), 0)`,
      audioBytes: sql<string>`coalesce(sum(case when ${storageObjects.objectType} = 'audio' then coalesce(${storageObjects.sizeBytes}, 0) else 0 end), 0)`,
      documentBytes: sql<string>`coalesce(sum(case when ${storageObjects.objectType} in ('document', 'attachment') then coalesce(${storageObjects.sizeBytes}, 0) else 0 end), 0)`,
      exportBytes: sql<string>`coalesce(sum(case when ${storageObjects.objectType} = 'export' then coalesce(${storageObjects.sizeBytes}, 0) else 0 end), 0)`,
      reportBytes: sql<string>`coalesce(sum(case when ${storageObjects.objectType} in ('report', 'summary_json') then coalesce(${storageObjects.sizeBytes}, 0) else 0 end), 0)`,
    })
    .from(storageObjects)
    .where(sql`${storageObjects.userId} = ${userId} and ${storageObjects.status} != 'deleted'`);

  const values = {
    totalBytes: String(totals?.totalBytes ?? "0"),
    transcriptBytes: String(totals?.transcriptBytes ?? "0"),
    audioBytes: String(totals?.audioBytes ?? "0"),
    documentBytes: String(totals?.documentBytes ?? "0"),
    exportBytes: String(totals?.exportBytes ?? "0"),
    reportBytes: String(totals?.reportBytes ?? "0"),
  };
  const [row] = await db
    .insert(storageUsage)
    .values({ userId, ...values })
    .onConflictDoUpdate({
      target: storageUsage.userId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();
  return publicStorageUsage(row ?? null);
}

export async function getStorageUsage(userId: string): Promise<PublicStorageUsage> {
  const [row] = await db.select().from(storageUsage).where(eq(storageUsage.userId, userId)).limit(1);
  return row ? publicStorageUsage(row) : recalculateStorageUsage(userId);
}

export function publicStorageUsage(row: StorageUsageRow | null): PublicStorageUsage {
  return {
    totalBytes: toNumber(row?.totalBytes),
    transcriptBytes: toNumber(row?.transcriptBytes),
    audioBytes: toNumber(row?.audioBytes),
    documentBytes: toNumber(row?.documentBytes),
    exportBytes: toNumber(row?.exportBytes),
    reportBytes: toNumber(row?.reportBytes),
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  };
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

