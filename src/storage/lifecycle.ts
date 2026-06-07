import { and, asc, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { db } from "../db/client.js";
import {
  agentTurns,
  cueEvents,
  researchAnswers,
  researchQueries,
  researchSources,
  roomSummaries,
  sessions,
  storageEvents,
  storageObjects,
  suggestions,
  transcriptSegments,
  voiceOutputs,
  type StorageObject,
  type StorageEventType,
} from "../db/schema.js";
import { buildStorageObjectKey, assertStorageKeyHasNoPii } from "./keys.js";
import { assertObjectSizeAllowed, canArchiveTranscript } from "./policy.js";
import { createStorageProvider } from "./provider.js";
import { recalculateStorageUsage } from "./usage.js";
import type { StorageObjectType, StorageOwnerType, StoragePutParams, StoredObjectSummary } from "./types.js";
import { StorageError } from "./types.js";

export async function putStoredObject(params: StoragePutParams): Promise<StorageObject> {
  assertObjectSizeAllowed(params.body.byteLength);
  const provider = createStorageProvider();
  const objectId = randomUUID();
  const objectKey = buildStorageObjectKey({
    userId: params.userId,
    ownerType: params.ownerType,
    ownerId: params.ownerId,
    objectType: params.objectType,
    objectId,
  });
  assertStorageKeyHasNoPii(objectKey);
  const put = await provider.putObject({ key: objectKey, body: params.body, contentType: params.contentType });
  const [row] = await db
    .insert(storageObjects)
    .values({
      id: objectId,
      userId: params.userId,
      ownerType: params.ownerType,
      ownerId: params.ownerId,
      objectType: params.objectType,
      provider: provider.providerName,
      bucket: provider.bucket,
      objectKey,
      contentType: params.contentType,
      sizeBytes: put.sizeBytes,
      checksum: put.checksum ?? null,
      encryptionKeyRef: config.STORAGE_ENCRYPT_OBJECTS ? "backend-side-encryption-future" : null,
      sensitivity: params.sensitivity ?? "low",
      retentionPolicy: params.retentionPolicy ?? "standard",
      status: "active",
    })
    .returning();
  if (!row) throw new StorageError("storage_object_create_failed", "Failed to create storage object metadata.", 500);
  await auditStorageEvent({ userId: params.userId, objectId: row.id, eventType: "created", payload: { ownerType: params.ownerType, ownerId: params.ownerId, objectType: params.objectType, sizeBytes: put.sizeBytes } });
  await recalculateStorageUsage(params.userId);
  return row;
}

export async function listStorageObjects(userId: string): Promise<StoredObjectSummary[]> {
  const rows = await db.select().from(storageObjects).where(eq(storageObjects.userId, userId)).orderBy(desc(storageObjects.createdAt)).limit(100);
  return rows.map(publicStorageObject);
}

export async function getOwnedStorageObject(userId: string, objectId: string): Promise<StorageObject | null> {
  const [row] = await db.select().from(storageObjects).where(and(eq(storageObjects.id, objectId), eq(storageObjects.userId, userId))).limit(1);
  return row ?? null;
}

export async function createStorageDownloadUrl(userId: string, objectId: string): Promise<{ url: string; expiresInSeconds: number }> {
  const object = await getOwnedStorageObject(userId, objectId);
  if (!object || object.status === "deleted") throw new StorageError("storage_object_not_found", "Storage object not found.", 404);
  const provider = createStorageProvider();
  if (provider.providerName !== object.provider) throw new StorageError("storage_provider_mismatch", "Configured storage provider does not match object metadata.", 409);
  const expiresInSeconds = config.R2_SIGNED_URL_TTL_SECONDS;
  const url = await provider.createSignedDownloadUrl({ key: object.objectKey, expiresInSeconds });
  await auditStorageEvent({ userId, objectId: object.id, eventType: "signed_url_created", payload: { expiresInSeconds } });
  return { url, expiresInSeconds };
}

export async function deleteOwnedStorageObject(userId: string, objectId: string): Promise<StoredObjectSummary> {
  const object = await getOwnedStorageObject(userId, objectId);
  if (!object || object.status === "deleted") throw new StorageError("storage_object_not_found", "Storage object not found.", 404);
  const provider = createStorageProvider();
  if (provider.providerName === object.provider) {
    await provider.deleteObject({ key: object.objectKey });
  }
  const [row] = await db
    .update(storageObjects)
    .set({ status: "deleted", deletedAt: new Date() })
    .where(and(eq(storageObjects.id, object.id), eq(storageObjects.userId, userId)))
    .returning();
  await auditStorageEvent({ userId, objectId: object.id, eventType: "deleted", payload: { ownerType: object.ownerType, ownerId: object.ownerId } });
  await recalculateStorageUsage(userId);
  return publicStorageObject(row ?? object);
}

export async function archiveSavedSessionTranscript(userId: string, sessionId: string): Promise<StorageObject | null> {
  if (!canArchiveTranscript()) return null;
  const [session] = await db.select().from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId))).limit(1);
  if (!session || session.status !== "saved") return null;
  const existing = await db.select({ id: storageObjects.id }).from(storageObjects).where(and(eq(storageObjects.userId, userId), eq(storageObjects.ownerType, "session"), eq(storageObjects.ownerId, sessionId), eq(storageObjects.objectType, "transcript"), eq(storageObjects.status, "active"))).limit(1);
  if (existing.length > 0) return null;
  const [transcript, turns, outputs, cues, suggestionRows] = await Promise.all([
    db.select().from(transcriptSegments).where(eq(transcriptSegments.sessionId, sessionId)).orderBy(asc(transcriptSegments.createdAt)),
    db.select().from(agentTurns).where(eq(agentTurns.sessionId, sessionId)).orderBy(asc(agentTurns.createdAt)),
    db.select().from(voiceOutputs).where(eq(voiceOutputs.sessionId, sessionId)).orderBy(asc(voiceOutputs.createdAt)),
    db.select().from(cueEvents).where(eq(cueEvents.sessionId, sessionId)).orderBy(asc(cueEvents.createdAt)),
    db.select().from(suggestions).where(eq(suggestions.sessionId, sessionId)).orderBy(asc(suggestions.createdAt)),
  ]);
  if (transcript.length === 0 && turns.length === 0 && outputs.length === 0) return null;
  const body = Buffer.from(JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    session: {
      id: session.id,
      internalType: session.internalType,
      title: session.title,
      status: session.status,
      retentionPolicy: session.retentionPolicy,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
    },
    transcript,
    agentTurns: turns,
    voiceOutputs: outputs,
    cues,
    suggestions: suggestionRows,
    rawAudioIncluded: false,
  }), "utf8");
  return putStoredObject({ userId, ownerType: "session", ownerId: sessionId, objectType: "transcript", contentType: "application/json", body, sensitivity: "medium", retentionPolicy: "standard" });
}

export async function cleanupDiscardedSessionStorage(userId: string, sessionId: string): Promise<void> {
  const rows = await db.select().from(storageObjects).where(and(eq(storageObjects.userId, userId), eq(storageObjects.ownerType, "session"), eq(storageObjects.ownerId, sessionId), eq(storageObjects.status, "active")));
  for (const object of rows) {
    await deleteOwnedStorageObject(userId, object.id).catch(() => undefined);
  }
}

export async function archiveResearchReport(userId: string, queryId: string): Promise<StorageObject | null> {
  if (config.STORAGE_PROVIDER === "none") return null;
  const [query] = await db.select().from(researchQueries).where(and(eq(researchQueries.id, queryId), eq(researchQueries.userId, userId))).limit(1);
  if (!query) return null;
  const [sources, answers] = await Promise.all([
    db.select().from(researchSources).where(eq(researchSources.queryId, query.id)).orderBy(asc(researchSources.createdAt)),
    db.select().from(researchAnswers).where(eq(researchAnswers.queryId, query.id)).orderBy(desc(researchAnswers.createdAt)).limit(1),
  ]);
  const answer = answers[0] ?? null;
  if (!answer) return null;
  const body = Buffer.from(JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    query: { id: query.id, query: query.query, normalizedQuery: query.normalizedQuery, intent: query.intent, status: query.status },
    answer: answer.answer,
    citations: answer.citations,
    sourceIds: sources.map((source) => source.id),
    sources: sources.map((source) => ({ id: source.id, url: source.url, title: source.title, sourceType: source.sourceType, snippet: source.snippet, credibilityScore: source.credibilityScore })),
    limitations: answer.limitations,
    qualityScore: answer.confidence,
  }), "utf8");
  return putStoredObject({ userId, ownerType: "research", ownerId: query.id, objectType: "report", contentType: "application/json", body, sensitivity: "low", retentionPolicy: "archive" });
}

export async function archiveRoomSummary(userId: string, roomId: string): Promise<StorageObject | null> {
  if (config.STORAGE_PROVIDER === "none") return null;
  const [summary] = await db.select().from(roomSummaries).where(eq(roomSummaries.roomId, roomId)).orderBy(desc(roomSummaries.createdAt)).limit(1);
  if (!summary) return null;
  const body = Buffer.from(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), summary, rawRecordingIncluded: false }), "utf8");
  return putStoredObject({ userId, ownerType: "room", ownerId: roomId, objectType: "summary_json", contentType: "application/json", body, sensitivity: "medium", retentionPolicy: "standard" });
}

export async function auditStorageEvent(args: { userId: string | null; objectId?: string | null; eventType: StorageEventType; payload?: Record<string, unknown> }) {
  const [row] = await db.insert(storageEvents).values({ userId: args.userId, objectId: args.objectId ?? null, eventType: args.eventType, payload: args.payload ?? {} }).returning();
  return row;
}

export function publicStorageObject(row: StorageObject): StoredObjectSummary {
  return {
    id: row.id,
    ownerType: row.ownerType,
    ownerId: row.ownerId,
    objectType: row.objectType,
    provider: row.provider,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    sensitivity: row.sensitivity,
    retentionPolicy: row.retentionPolicy,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

export type { StorageOwnerType, StorageObjectType };
