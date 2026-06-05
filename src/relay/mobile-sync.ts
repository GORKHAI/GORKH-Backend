import { and, asc, eq, gt, or } from "drizzle-orm";
import { db } from "../db/client.js";
import { agentRequestMessages, agentRequests } from "../db/schema.js";
import { safeMessage, safeRequestForUser } from "./safety.js";

export async function relayMobileSyncItems(userId: string, since: Date, limit: number) {
  const [requests, messages] = await Promise.all([
    db
      .select()
      .from(agentRequests)
      .where(and(or(eq(agentRequests.fromUserId, userId), eq(agentRequests.toUserId, userId)), gt(agentRequests.updatedAt, since)))
      .orderBy(asc(agentRequests.updatedAt))
      .limit(limit),
    db
      .select()
      .from(agentRequestMessages)
      .where(gt(agentRequestMessages.createdAt, since))
      .orderBy(asc(agentRequestMessages.createdAt))
      .limit(limit),
  ]);
  const visibleMessages = [];
  for (const message of messages) {
    const [request] = await db
      .select()
      .from(agentRequests)
      .where(and(eq(agentRequests.id, message.requestId), or(eq(agentRequests.fromUserId, userId), eq(agentRequests.toUserId, userId))))
      .limit(1);
    if (request) visibleMessages.push({ message, request });
  }
  return [
    ...requests.map((request) => ({
      type: request.toUserId === userId && ["sent", "received"].includes(request.status) ? "relay_request_received" : request.status === "pending_sender_approval" ? "relay_approval_needed" : "relay_request_updated",
      createdAt: request.updatedAt,
      item: safeRequestForUser(request, userId),
    })),
    ...visibleMessages.map(({ message }) => ({ type: "relay_request_message", createdAt: message.createdAt, item: safeMessage(message, userId) })),
  ];
}
