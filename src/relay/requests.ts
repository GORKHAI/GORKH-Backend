import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { safeContact, safeMessage, safeRequestForUser } from "./safety.js";
import {
  addRelayMessage,
  approveRelaySend,
  cancelRelayRequest,
  createInvestorRelayRequest,
  createRelayContact,
  createRelayDraft,
  createRoomRelayInviteRequest,
  decideIncomingRelayRequest,
  getOrCreateRelayIdentity,
  getRelayRequestForUser,
  listRelayAuditEvents,
  listRelayContacts,
  listRelayInbox,
  listRelayMessages,
  listRelayOutbox,
  updateRelayContactStatus,
  updateRelayIdentity,
} from "./service.js";
import { RelayPolicyError, relayErrorStatus } from "./policy.js";
import { relayContactBodySchema, relayDecisionBodySchema, relayDraftBodySchema, relayIdentityBodySchema, relayMessageBodySchema } from "./types.js";

type RequireAuth = (request: FastifyRequest, reply: FastifyReply) => Promise<string | null>;

const idParamsSchema = z.object({ id: z.string().uuid() });

export function registerRelayRoutes(app: FastifyInstance, requireAuth: RequireAuth) {
  app.get("/relay/identity", async (request, reply) => withRelayAuth(request, reply, requireAuth, async (userId) => {
    return { identity: await getOrCreateRelayIdentity(userId) };
  }));

  app.post("/relay/identity", async (request, reply) => withRelayAuth(request, reply, requireAuth, async (userId) => {
    return { identity: await updateRelayIdentity(userId, relayIdentityBodySchema.parse(request.body)) };
  }));

  app.get("/relay/contacts", async (request, reply) => withRelayAuth(request, reply, requireAuth, async (userId) => {
    const contacts = await listRelayContacts(userId);
    return { contacts: contacts.map(safeContact) };
  }));

  app.post("/relay/contacts", async (request, reply) => withRelayAuth(request, reply, requireAuth, async (userId) => {
    return { contact: safeContact(await createRelayContact(userId, relayContactBodySchema.parse(request.body))) };
  }));

  app.post("/relay/contacts/:id/trust", async (request, reply) => withRelayAuth(request, reply, requireAuth, async (userId) => {
    const params = idParamsSchema.parse(request.params);
    return { contact: safeContact(await updateRelayContactStatus(userId, params.id, "trusted")) };
  }));

  app.post("/relay/contacts/:id/block", async (request, reply) => withRelayAuth(request, reply, requireAuth, async (userId) => {
    const params = idParamsSchema.parse(request.params);
    return { contact: safeContact(await updateRelayContactStatus(userId, params.id, "blocked")) };
  }));

  app.post("/relay/contacts/:id/remove", async (request, reply) => withRelayAuth(request, reply, requireAuth, async (userId) => {
    const params = idParamsSchema.parse(request.params);
    return { contact: safeContact(await updateRelayContactStatus(userId, params.id, "removed")) };
  }));

  app.post("/relay/requests/draft", async (request, reply) => withRelayAuth(request, reply, requireAuth, async (userId) => {
    const relayRequest = await createRelayDraft(userId, relayDraftBodySchema.parse(request.body));
    return { request: safeRequestForUser(relayRequest, userId), approvalCard: approvalCard(relayRequest) };
  }));

  app.post("/relay/requests/:id/approve-send", async (request, reply) => withRelayAuth(request, reply, requireAuth, async (userId) => {
    const params = idParamsSchema.parse(request.params);
    const result = await approveRelaySend(userId, params.id);
    return { request: safeRequestForUser(result.request, userId), approval: result.approval, externalEmailSent: false };
  }));

  app.post("/relay/requests/:id/cancel", async (request, reply) => withRelayAuth(request, reply, requireAuth, async (userId) => {
    const params = idParamsSchema.parse(request.params);
    return { request: safeRequestForUser(await cancelRelayRequest(userId, params.id), userId) };
  }));

  app.get("/relay/requests/outbox", async (request, reply) => withRelayAuth(request, reply, requireAuth, async (userId) => {
    const rows = await listRelayOutbox(userId);
    return { requests: rows.map((row) => safeRequestForUser(row, userId)) };
  }));

  app.get("/relay/requests/inbox", async (request, reply) => withRelayAuth(request, reply, requireAuth, async (userId) => {
    const rows = await listRelayInbox(userId);
    return { requests: rows.map((row) => safeRequestForUser(row, userId)) };
  }));

  app.get("/relay/requests/:id", async (request, reply) => withRelayAuth(request, reply, requireAuth, async (userId) => {
    const params = idParamsSchema.parse(request.params);
    return { request: safeRequestForUser(await getRelayRequestForUser(userId, params.id), userId) };
  }));

  app.post("/relay/requests/:id/approve", async (request, reply) => decideRelayRequest(request, reply, requireAuth, "approve"));
  app.post("/relay/requests/:id/reject", async (request, reply) => decideRelayRequest(request, reply, requireAuth, "reject"));
  app.post("/relay/requests/:id/ignore", async (request, reply) => decideRelayRequest(request, reply, requireAuth, "ignore"));
  app.post("/relay/requests/:id/block-sender", async (request, reply) => decideRelayRequest(request, reply, requireAuth, "block"));

  app.get("/relay/requests/:id/messages", async (request, reply) => withRelayAuth(request, reply, requireAuth, async (userId) => {
    const params = idParamsSchema.parse(request.params);
    const messages = await listRelayMessages(userId, params.id);
    return { messages: messages.map((message) => safeMessage(message, userId)) };
  }));

  app.post("/relay/requests/:id/messages", async (request, reply) => withRelayAuth(request, reply, requireAuth, async (userId) => {
    const params = idParamsSchema.parse(request.params);
    const body = relayMessageBodySchema.parse(request.body);
    return { message: safeMessage(await addRelayMessage(userId, params.id, body.body), userId) };
  }));

  app.get("/relay/audit-events", async (request, reply) => withRelayAuth(request, reply, requireAuth, async (userId) => {
    return { auditEvents: await listRelayAuditEvents(userId) };
  }));

  app.post("/outreach/investors/:id/create-relay-request", async (request, reply) => withRelayAuth(request, reply, requireAuth, async (userId) => {
    const params = idParamsSchema.parse(request.params);
    const relayRequest = await createInvestorRelayRequest(userId, params.id);
    return { request: safeRequestForUser(relayRequest, userId), approvalCard: approvalCard(relayRequest), externalEmailSent: false };
  }));

  app.post("/rooms/:id/create-relay-invite-request", async (request, reply) => withRelayAuth(request, reply, requireAuth, async (userId) => {
    const params = idParamsSchema.parse(request.params);
    const relayRequest = await createRoomRelayInviteRequest(userId, params.id);
    return { request: safeRequestForUser(relayRequest, userId), approvalCard: approvalCard(relayRequest), externalEmailSent: false };
  }));
}

async function decideRelayRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  requireAuth: RequireAuth,
  decision: "approve" | "reject" | "ignore" | "block",
) {
  return withRelayAuth(request, reply, requireAuth, async (userId) => {
    const params = idParamsSchema.parse(request.params);
    const input = relayDecisionBodySchema.parse(request.body ?? {});
    const result = await decideIncomingRelayRequest(userId, params.id, decision, input);
    return { request: safeRequestForUser(result.request, userId), approval: result.approval };
  });
}

async function withRelayAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  requireAuth: RequireAuth,
  handler: (userId: string) => Promise<unknown>,
) {
  const userId = await requireAuth(request, reply);
  if (!userId) return;
  try {
    return reply.send(await handler(userId));
  } catch (err) {
    return sendRelayError(reply, err);
  }
}

function sendRelayError(reply: FastifyReply, err: unknown) {
  if (err instanceof RelayPolicyError) {
    return reply.code(relayErrorStatus(err)).send({ error: { code: err.code, message: err.message, retryable: err.code === "rate_limited" } });
  }
  if (err instanceof z.ZodError) {
    return reply.code(400).send({ error: { code: "invalid_message", message: "Invalid Relay request payload.", retryable: false, details: err.flatten() } });
  }
  throw err;
}

function approvalCard(request: { id: string; title: string; summary: string }) {
  return {
    type: "relay_request_approval" as const,
    requestId: request.id,
    title: request.title,
    summary: request.summary,
    confirmLabel: "Send Request" as const,
    cancelLabel: "Cancel" as const,
  };
}
