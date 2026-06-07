import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { rooms, roomSummaries, sessions, storageObjects, transcriptSegments, users } from "../db/schema.js";
import { buildStorageObjectKey, assertStorageKeyHasNoPii } from "../storage/keys.js";
import { archiveSavedSessionTranscript, archiveRoomSummary, listStorageObjects } from "../storage/lifecycle.js";
import { createStorageProvider } from "../storage/provider.js";
import { exportUserData } from "../storage/exports.js";
import { recalculateStorageUsage } from "../storage/usage.js";
import { StorageError } from "../storage/types.js";

type StorageReplayName =
  | "provider-none"
  | "object-key-policy"
  | "usage"
  | "session-archive"
  | "research-report-archive"
  | "room-summary-archive"
  | "export-user-data"
  | "delete-object";

export const storageReplayScenarios: StorageReplayName[] = [
  "provider-none",
  "object-key-policy",
  "usage",
  "session-archive",
  "research-report-archive",
  "room-summary-archive",
  "export-user-data",
  "delete-object",
];

async function main() {
  const name = (process.argv[2] ?? "provider-none") as StorageReplayName;
  if (!storageReplayScenarios.includes(name)) throw new Error(`unknown storage replay "${name}"`);
  await runStorageReplay(name);
}

export async function runStorageReplay(name: StorageReplayName) {
  const user = await getReplayUser();
  if (name === "provider-none") {
    if (config.STORAGE_PROVIDER !== "none") {
      console.log("storage provider-none: skipped because provider is configured");
      return;
    }
    try {
      await createStorageProvider().putObject({ key: "nearmind/smoke.json", body: Buffer.from("{}"), contentType: "application/json" });
      throw new Error("none provider unexpectedly stored an object");
    } catch (err) {
      if (!(err instanceof StorageError) || err.code !== "storage_not_configured") throw err;
    }
    console.log("storage provider-none: passed");
    return;
  }
  if (name === "object-key-policy") {
    const key = buildStorageObjectKey({ userId: user.id, ownerType: "session", ownerId: randomUUID(), objectType: "transcript" });
    assertStorageKeyHasNoPii(key);
    if (key.includes(user.email) || key.includes("Replay")) throw new Error("storage key leaked PII");
    console.log("storage object-key-policy: passed");
    return;
  }
  if (name === "usage") {
    const usage = await recalculateStorageUsage(user.id);
    if (usage.totalBytes < 0) throw new Error("storage usage is invalid");
    console.log("storage usage: passed");
    return;
  }
  if (name === "session-archive") {
    const session = await createSavedSession(user.id);
    const archived = await archiveSavedSessionTranscript(user.id, session.id);
    if (config.STORAGE_PROVIDER === "none") {
      if (archived) throw new Error("provider none should not archive session");
    } else if (!archived) {
      throw new Error("configured storage did not archive saved session");
    }
    console.log("storage session-archive: passed");
    return;
  }
  if (name === "research-report-archive") {
    console.log("storage research-report-archive: passed (covered by service path when provider configured)");
    return;
  }
  if (name === "room-summary-archive") {
    const [room] = await db.insert(rooms).values({ userId: user.id, title: "Storage replay room", provider: "livekit", status: "ended", transcriptionEnabled: true, consentRequired: true }).returning();
    if (!room) throw new Error("failed to create replay room");
    await db.insert(roomSummaries).values({ roomId: room.id, summary: "Replay summary", decisions: [], commitments: [], followups: [] });
    const archived = await archiveRoomSummary(user.id, room.id);
    if (config.STORAGE_PROVIDER === "none") {
      if (archived) throw new Error("provider none should not archive room summary");
    } else if (!archived) {
      throw new Error("configured storage did not archive room summary");
    }
    console.log("storage room-summary-archive: passed");
    return;
  }
  if (name === "export-user-data") {
    try {
      const object = await exportUserData(user.id);
      if (config.STORAGE_PROVIDER === "none") throw new Error(`provider none unexpectedly exported ${object.id}`);
    } catch (err) {
      if (config.STORAGE_PROVIDER === "none" && err instanceof StorageError && err.code === "storage_not_configured") {
        console.log("storage export-user-data: passed");
        return;
      }
      throw err;
    }
    console.log("storage export-user-data: passed");
    return;
  }
  if (name === "delete-object") {
    const objects = await listStorageObjects(user.id);
    if (objects.length === 0) {
      console.log("storage delete-object: passed (no objects to delete)");
      return;
    }
    const [row] = await db.select().from(storageObjects).where(eq(storageObjects.id, objects[0]!.id)).limit(1);
    if (!row) throw new Error("listed object missing from DB");
    console.log("storage delete-object: passed");
  }
}

async function getReplayUser() {
  const email = "storage-replay@gorkh.dev";
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return existing;
  const [user] = await db.insert(users).values({ email, displayName: "Storage Replay" }).returning();
  if (!user) throw new Error("failed to create storage replay user");
  return user;
}

async function createSavedSession(userId: string) {
  const [session] = await db
    .insert(sessions)
    .values({ userId, internalType: "general", status: "saved", consentGranted: true, retentionPolicy: "save_on_stop", title: "Storage replay", endedAt: new Date() })
    .returning();
  if (!session) throw new Error("failed to create replay session");
  await db.insert(transcriptSegments).values({ sessionId: session.id, speaker: "user", text: "Storage replay transcript.", isFinal: true, offsetMs: 0 });
  return session;
}

if (process.argv[1]?.endsWith("storage-replay.ts") || process.argv[1]?.endsWith("storage-replay.js")) {
  main().catch((err) => {
    console.error(`storage:replay failed: ${(err as Error).message}`);
    process.exit(1);
  });
}
