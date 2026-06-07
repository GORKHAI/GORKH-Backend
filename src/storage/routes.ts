import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { storageEvents } from "../db/schema.js";
import { exportUserData } from "./exports.js";
import { createStorageDownloadUrl, deleteOwnedStorageObject, getOwnedStorageObject, listStorageObjects, publicStorageObject } from "./lifecycle.js";
import { requestStorageDeletion } from "./deletion.js";
import { storageProviderStatus } from "./provider.js";
import { getStorageUsage } from "./usage.js";
import { StorageError } from "./types.js";

type RequireAuth = (request: FastifyRequest, reply: FastifyReply) => Promise<string | null>;

const idParams = z.object({ id: z.string().uuid() });
const deleteAllBody = z.object({ reason: z.string().max(1000).nullable().optional() });

export function registerStorageRoutes(app: FastifyInstance, requireAuth: RequireAuth) {
  app.get("/storage/status", async (_, reply) => reply.send({ storage: storageProviderStatus(), fairUseLimitsApply: true }));

  app.get("/storage/usage", async (request, reply) => withStorageAuth(request, reply, requireAuth, async (userId) => ({ usage: await getStorageUsage(userId) })));

  app.get("/storage/objects", async (request, reply) => withStorageAuth(request, reply, requireAuth, async (userId) => ({ objects: await listStorageObjects(userId) })));

  app.get("/storage/objects/:id", async (request, reply) => withStorageAuth(request, reply, requireAuth, async (userId) => {
    const params = idParams.parse(request.params);
    const object = await getOwnedStorageObject(userId, params.id);
    if (!object) throw new StorageError("storage_object_not_found", "Storage object not found.", 404);
    return { object: publicStorageObject(object) };
  }));

  app.post("/storage/objects/:id/download-url", async (request, reply) => withStorageAuth(request, reply, requireAuth, async (userId) => {
    const params = idParams.parse(request.params);
    return await createStorageDownloadUrl(userId, params.id);
  }));

  app.delete("/storage/objects/:id", async (request, reply) => withStorageAuth(request, reply, requireAuth, async (userId) => {
    const params = idParams.parse(request.params);
    return { object: await deleteOwnedStorageObject(userId, params.id) };
  }));

  app.get("/storage/events", async (request, reply) => withStorageAuth(request, reply, requireAuth, async (userId) => {
    const events = await db.select().from(storageEvents).where(eq(storageEvents.userId, userId)).orderBy(desc(storageEvents.createdAt)).limit(100);
    return { events };
  }));

  app.post("/storage/export", async (request, reply) => withStorageAuth(request, reply, requireAuth, async (userId) => {
    const object = await exportUserData(userId);
    return { export: publicStorageObject(object) };
  }));

  app.get("/storage/export/:id", async (request, reply) => withStorageAuth(request, reply, requireAuth, async (userId) => {
    const params = idParams.parse(request.params);
    const object = await getOwnedStorageObject(userId, params.id);
    if (!object || object.objectType !== "export") throw new StorageError("storage_export_not_found", "Export file not found.", 404);
    return { export: publicStorageObject(object) };
  }));

  app.post("/storage/delete-all-request", async (request, reply) => withStorageAuth(request, reply, requireAuth, async (userId) => {
    const body = deleteAllBody.parse(request.body ?? {});
    return { deletionRequest: await requestStorageDeletion(userId, body.reason ?? null) };
  }));
}

async function withStorageAuth(request: FastifyRequest, reply: FastifyReply, requireAuth: RequireAuth, handler: (userId: string) => Promise<unknown>) {
  const userId = await requireAuth(request, reply);
  if (!userId) return;
  try {
    return reply.send(await handler(userId));
  } catch (err) {
    if (err instanceof StorageError) {
      return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message, retryable: false } });
    }
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: { code: "invalid_storage_payload", message: "Invalid storage request payload.", retryable: false, details: err.flatten() } });
    }
    throw err;
  }
}

