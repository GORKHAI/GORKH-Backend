import { asc, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { db } from "../db/client.js";
import {
  actionProposals,
  agentRequests,
  commitments,
  connectorAccounts,
  dailyBriefs,
  humanProfileFacts,
  memorySummaries,
  outreachCampaigns,
  roomSummaries,
  rooms,
  sessions,
  storageObjects,
  taskItems,
  users,
} from "../db/schema.js";
import { redactForUserExport } from "./redaction.js";
import { putStoredObject } from "./lifecycle.js";
import { StorageError } from "./types.js";

export async function exportUserData(userId: string) {
  if (!config.STORAGE_EXPORTS_ENABLED) throw new StorageError("storage_exports_disabled", "User data exports are not enabled.", 403);
  if (config.STORAGE_PROVIDER === "none") throw new StorageError("storage_not_configured", "Long-term object storage is not configured for export files.", 503);

  const [
    [user],
    facts,
    summaries,
    sessionRows,
    tasks,
    commitmentsRows,
    briefs,
    relayRows,
    actionRows,
    campaigns,
    roomRows,
    roomSummaryRows,
    connectorRows,
    objectRows,
  ] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    db.select().from(humanProfileFacts).where(eq(humanProfileFacts.userId, userId)).orderBy(asc(humanProfileFacts.createdAt)),
    db.select().from(memorySummaries).where(eq(memorySummaries.userId, userId)).orderBy(asc(memorySummaries.createdAt)),
    db.select().from(sessions).where(eq(sessions.userId, userId)).orderBy(desc(sessions.startedAt)).limit(500),
    db.select().from(taskItems).where(eq(taskItems.userId, userId)).orderBy(desc(taskItems.createdAt)).limit(500),
    db.select().from(commitments).where(eq(commitments.userId, userId)).orderBy(desc(commitments.createdAt)).limit(500),
    db.select().from(dailyBriefs).where(eq(dailyBriefs.userId, userId)).orderBy(desc(dailyBriefs.generatedAt)).limit(365),
    db.select().from(agentRequests).where(eq(agentRequests.fromUserId, userId)).orderBy(desc(agentRequests.createdAt)).limit(500),
    db.select().from(actionProposals).where(eq(actionProposals.userId, userId)).orderBy(desc(actionProposals.createdAt)).limit(500),
    db.select().from(outreachCampaigns).where(eq(outreachCampaigns.userId, userId)).orderBy(desc(outreachCampaigns.createdAt)).limit(200),
    db.select().from(rooms).where(eq(rooms.userId, userId)).orderBy(desc(rooms.createdAt)).limit(200),
    db.select().from(roomSummaries).innerJoin(rooms, eq(roomSummaries.roomId, rooms.id)).where(eq(rooms.userId, userId)).orderBy(desc(roomSummaries.createdAt)).limit(200),
    db.select().from(connectorAccounts).where(eq(connectorAccounts.userId, userId)).orderBy(desc(connectorAccounts.createdAt)),
    db.select().from(storageObjects).where(eq(storageObjects.userId, userId)).orderBy(desc(storageObjects.createdAt)),
  ]);
  if (!user) throw new StorageError("account_not_found", "Account not found.", 404);
  const payload = redactForUserExport({
    version: 1,
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt },
    profileFacts: facts,
    memorySummaries: summaries,
    sessions: sessionRows.filter((session) => session.status !== "discarded"),
    tasks,
    commitments: commitmentsRows,
    dailyBriefs: briefs,
    relayRequests: relayRows,
    actionProposals: actionRows,
    outreachCampaigns: campaigns,
    rooms: roomRows,
    roomSummaries: roomSummaryRows.map((row) => row.room_summaries),
    connectorAccounts: connectorRows.map((row) => ({ id: row.id, provider: row.provider, accountEmail: row.accountEmail, status: row.status, scopes: row.scopes, createdAt: row.createdAt, updatedAt: row.updatedAt })),
    storageObjectManifest: objectRows.map((object) => ({ id: object.id, ownerType: object.ownerType, ownerId: object.ownerId, objectType: object.objectType, sizeBytes: object.sizeBytes, status: object.status, createdAt: object.createdAt })),
    excludes: ["raw tokens", "OAuth tokens", "provider keys", "encrypted token payloads", "deleted/discarded content"],
  });
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  return putStoredObject({ userId, ownerType: "export", ownerId: randomUUID(), objectType: "export", contentType: "application/json", body, sensitivity: "sensitive", retentionPolicy: "user_controlled" });
}
