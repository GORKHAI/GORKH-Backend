import { and, asc, desc, eq, or } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  agentBlocks,
  agentIdentities,
  agentRelayAuditEvents,
  agentRequestApprovals,
  agentRequestMessages,
  agentRequests,
  investorProfiles,
  outreachCampaigns,
  rooms,
  trustedContacts,
  users,
  type AgentRequest,
  type AgentRequestType,
} from "../db/schema.js";
import { createMobileNotification } from "../mobile/notifications.js";
import { logRelayAuditEvent } from "./audit.js";
import {
  RelayPolicyError,
  assertContactOwned,
  assertNoMassBroadcast,
  assertNoPrivateDataSharing,
  assertRequestTypeAllowed,
  assertSenderRateLimit,
  isBlockedByRecipient,
} from "./policy.js";
import { riskForRequest, titleForRequestType, type RelayContactInput, type RelayDecisionInput, type RelayDraftInput, type RelayIdentityInput } from "./types.js";

export async function getOrCreateRelayIdentity(userId: string) {
  const [existing] = await db.select().from(agentIdentities).where(eq(agentIdentities.userId, userId)).limit(1);
  if (existing) return existing;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const [identity] = await db
    .insert(agentIdentities)
    .values({
      userId,
      displayName: user?.displayName ?? user?.email ?? "NearMind user",
      profileVisibility: "private",
      relayEnabled: true,
    })
    .returning();
  if (!identity) throw new Error("failed to create relay identity");
  await logRelayAuditEvent({ userId, eventType: "relay_identity_created", payload: { identityId: identity.id } });
  return identity;
}

export async function updateRelayIdentity(userId: string, input: RelayIdentityInput) {
  await getOrCreateRelayIdentity(userId);
  const [identity] = await db
    .update(agentIdentities)
    .set({
      displayName: input.displayName,
      headline: input.headline ?? null,
      professionalRole: input.professionalRole ?? null,
      companyName: input.companyName ?? null,
      profileVisibility: input.profileVisibility ?? "private",
      relayEnabled: input.relayEnabled ?? true,
      updatedAt: new Date(),
    })
    .where(eq(agentIdentities.userId, userId))
    .returning();
  if (!identity) throw new Error("failed to update relay identity");
  await logRelayAuditEvent({ userId, eventType: "relay_identity_updated", payload: { identityId: identity.id } });
  return identity;
}

export function listRelayContacts(userId: string) {
  return db.select().from(trustedContacts).where(eq(trustedContacts.userId, userId)).orderBy(desc(trustedContacts.updatedAt)).limit(100);
}

export async function createRelayContact(userId: string, input: RelayContactInput) {
  const email = input.email?.toLowerCase() ?? null;
  const [linkedUser] = email ? await db.select().from(users).where(eq(users.email, email)).limit(1) : [];
  const [contact] = await db
    .insert(trustedContacts)
    .values({
      userId,
      contactUserId: linkedUser?.id ?? null,
      displayName: input.displayName,
      email,
      companyName: input.companyName ?? null,
      relationship: input.relationship ?? null,
      status: linkedUser ? "proposed" : "invited",
      trustLevel: input.trustLevel ?? "standard",
    })
    .returning();
  if (!contact) throw new Error("failed to create trusted contact");
  await logRelayAuditEvent({ userId, eventType: "relay_contact_created", payload: { contactId: contact.id, linkedUser: Boolean(linkedUser) } });
  return contact;
}

export async function updateRelayContactStatus(userId: string, contactId: string, status: "trusted" | "blocked" | "removed") {
  const [contact] = await db
    .update(trustedContacts)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(trustedContacts.id, contactId), eq(trustedContacts.userId, userId)))
    .returning();
  if (!contact) throw new RelayPolicyError("not_found", "Trusted contact not found.");
  if (status === "blocked") {
    await db.insert(agentBlocks).values({ userId, blockedUserId: contact.contactUserId ?? null, blockedEmail: contact.email ?? null, reason: "contact_blocked" });
  }
  await logRelayAuditEvent({ userId, eventType: `relay_contact_${status}`, payload: { contactId } });
  return contact;
}

export async function createRelayDraft(userId: string, input: RelayDraftInput) {
  await getOrCreateRelayIdentity(userId);
  await assertSenderRateLimit(userId);
  if (input.requestType !== "team_update_request") {
    assertNoMassBroadcast({ goal: input.goal });
  }
  assertNoPrivateDataSharing(input.context ?? {}, "context");
  assertNoPrivateDataSharing(input.requestedShare ?? {}, "requested share");

  const recipient = await resolveRecipient(userId, input.recipient);
  const title = titleForRequestType(input.requestType, recipient.displayName);
  const requestedShare = input.requestedShare ?? {};
  const riskLevel = riskForRequest(input.requestType, requestedShare);
  const status = input.requestType === "team_update_request" ? "draft" : "pending_sender_approval";
  const context = safeDraftContext(input);
  const [request] = await db
    .insert(agentRequests)
    .values({
      fromUserId: userId,
      toUserId: recipient.toUserId,
      toContactId: recipient.toContactId,
      requestType: input.requestType,
      title,
      summary: buildDraftSummary(input, recipient.displayName),
      context,
      requestedShare,
      riskLevel,
      status,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    })
    .returning();
  if (!request) throw new Error("failed to create relay request");
  await db.insert(agentRequestMessages).values({ requestId: request.id, userId, role: "sender_agent", body: request.summary, safeForRecipient: true });
  await logRelayAuditEvent({ userId, requestId: request.id, eventType: "relay_request_drafted", payload: { requestType: input.requestType, status } });
  if (status === "pending_sender_approval") {
    await createMobileNotification({
      userId,
      type: "relay_approval_needed",
      title: "Relay request needs approval",
      body: request.title,
      payload: { requestId: request.id, requestType: request.requestType },
      priority: riskLevel === "high" ? "high" : "normal",
    });
  }
  return request;
}

export async function approveRelaySend(userId: string, requestId: string) {
  const request = await getSenderRequest(userId, requestId);
  if (!["pending_sender_approval", "draft"].includes(request.status)) throw new RelayPolicyError("not_allowed", `Cannot send request in status ${request.status}.`);
  assertRequestTypeAllowed(request.requestType);
  const contact = request.toContactId ? await assertContactOwned(userId, request.toContactId) : null;
  const recipientUserId = request.toUserId ?? contact?.contactUserId ?? null;
  const recipientEmail = contact?.email ?? null;
  if (!recipientUserId && !recipientEmail) throw new RelayPolicyError("not_found", "Relay request needs a recipient.");
  if (await isBlockedByRecipient({ senderUserId: userId, recipientUserId, recipientEmail })) throw new RelayPolicyError("blocked", "Recipient has blocked this sender.");

  const [updated] = await db.update(agentRequests).set({ toUserId: recipientUserId, status: "sent", updatedAt: new Date() }).where(and(eq(agentRequests.id, requestId), eq(agentRequests.fromUserId, userId))).returning();
  if (!updated) throw new Error("failed to approve relay send");
  const [approval] = await db.insert(agentRequestApprovals).values({ requestId, userId, decision: "approved_to_send" }).returning();
  await logRelayAuditEvent({ userId, requestId, eventType: "relay_request_sent", payload: { toUserId: recipientUserId, toContactId: updated.toContactId, noExternalEmailSent: true } });
  if (recipientUserId) {
    await createMobileNotification({
      userId: recipientUserId,
      type: "relay_request_received",
      title: "New agent request",
      body: updated.title,
      payload: { requestId: updated.id, requestType: updated.requestType },
      priority: updated.riskLevel === "high" ? "high" : "normal",
    });
  } else {
    await createMobileNotification({ userId, type: "relay_request_updated", title: "Relay request staged", body: "No external email was sent.", payload: { requestId }, priority: "normal" });
  }
  return { request: updated, approval, externalEmailSent: false };
}

export async function cancelRelayRequest(userId: string, requestId: string) {
  const [request] = await db
    .update(agentRequests)
    .set({ status: "canceled", updatedAt: new Date() })
    .where(and(eq(agentRequests.id, requestId), eq(agentRequests.fromUserId, userId)))
    .returning();
  if (!request) throw new RelayPolicyError("not_found", "Relay request not found.");
  await logRelayAuditEvent({ userId, requestId, eventType: "relay_request_canceled", payload: {} });
  return request;
}

export async function decideIncomingRelayRequest(userId: string, requestId: string, decision: "approve" | "reject" | "ignore" | "block", input: RelayDecisionInput = {}) {
  const request = await getRecipientRequest(userId, requestId);
  if (!["sent", "received"].includes(request.status)) throw new RelayPolicyError("not_allowed", `Cannot decide request in status ${request.status}.`);
  const status = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : decision === "ignore" ? "ignored" : "blocked";
  const approvalDecision = decision === "approve" ? "approved_to_share" : decision === "reject" ? "rejected_to_share" : decision === "ignore" ? "ignored" : "blocked";
  const approvedPayload = decision === "approve" ? input.approvedPayload ?? {} : null;
  assertNoPrivateDataSharing((approvedPayload ?? {}) as Record<string, unknown>, "approved payload");
  const [updated] = await db.update(agentRequests).set({ status, updatedAt: new Date() }).where(and(eq(agentRequests.id, requestId), eq(agentRequests.toUserId, userId))).returning();
  if (!updated) throw new Error("failed to decide relay request");
  const [approval] = await db.insert(agentRequestApprovals).values({ requestId, userId, decision: approvalDecision, approvedPayload, reason: input.reason ?? null }).returning();
  if (decision === "approve") {
    await db.insert(agentRequestMessages).values({ requestId, userId, role: "receiver_human", body: `Approved to share: ${JSON.stringify(approvedPayload ?? {})}`, safeForRecipient: true });
  }
  if (decision === "block") {
    await db.insert(agentBlocks).values({ userId, blockedUserId: request.fromUserId, reason: input.reason ?? "blocked_sender" });
  }
  await logRelayAuditEvent({ userId, requestId, eventType: `relay_request_${status}`, payload: { decision, approvedPayload: approvedPayload ?? undefined } });
  await createMobileNotification({
    userId: request.fromUserId,
    type: "relay_request_updated",
    title: `Relay request ${status}`,
    body: updated.title,
    payload: { requestId, status },
    priority: status === "approved" ? "high" : "normal",
  });
  return { request: updated, approval };
}

export async function listRelayOutbox(userId: string) {
  return db.select().from(agentRequests).where(eq(agentRequests.fromUserId, userId)).orderBy(desc(agentRequests.updatedAt)).limit(100);
}

export async function listRelayInbox(userId: string) {
  return db.select().from(agentRequests).where(eq(agentRequests.toUserId, userId)).orderBy(desc(agentRequests.updatedAt)).limit(100);
}

export async function getRelayRequestForUser(userId: string, requestId: string) {
  const [request] = await db
    .select()
    .from(agentRequests)
    .where(and(eq(agentRequests.id, requestId), or(eq(agentRequests.fromUserId, userId), eq(agentRequests.toUserId, userId))))
    .limit(1);
  if (!request) throw new RelayPolicyError("not_found", "Relay request not found.");
  return request;
}

export async function listRelayMessages(userId: string, requestId: string) {
  await getRelayRequestForUser(userId, requestId);
  return db.select().from(agentRequestMessages).where(eq(agentRequestMessages.requestId, requestId)).orderBy(asc(agentRequestMessages.createdAt)).limit(100);
}

export async function addRelayMessage(userId: string, requestId: string, body: string) {
  const request = await getRelayRequestForUser(userId, requestId);
  const role = request.fromUserId === userId ? "sender_human" : "receiver_human";
  const [message] = await db.insert(agentRequestMessages).values({ requestId, userId, role, body, safeForRecipient: true }).returning();
  if (!message) throw new Error("failed to add relay message");
  await logRelayAuditEvent({ userId, requestId, eventType: "relay_message_added", payload: { role } });
  const notifyUserId = request.fromUserId === userId ? request.toUserId : request.fromUserId;
  if (notifyUserId) {
    await createMobileNotification({ userId: notifyUserId, type: "relay_request_message", title: "New Relay message", body: request.title, payload: { requestId }, priority: "normal" });
  }
  return message;
}

export async function listRelayAuditEvents(userId: string) {
  return db.select().from(agentRelayAuditEvents).where(eq(agentRelayAuditEvents.userId, userId)).orderBy(desc(agentRelayAuditEvents.createdAt)).limit(100);
}

export async function createInvestorRelayRequest(userId: string, investorId: string) {
  const [investor] = await db.select().from(investorProfiles).where(and(eq(investorProfiles.id, investorId), eq(investorProfiles.userId, userId))).limit(1);
  if (!investor) throw new RelayPolicyError("not_found", "Investor not found.");
  const [campaign] = investor.campaignId ? await db.select().from(outreachCampaigns).where(and(eq(outreachCampaigns.id, investor.campaignId), eq(outreachCampaigns.userId, userId))).limit(1) : [];
  return createRelayDraft(userId, {
    requestType: "investor_interest_check",
    recipient: { email: investor.email ?? undefined, displayName: investor.partnerName ?? investor.firmName },
    goal: "Ask whether they want to review the deck.",
    context: {
      investorId: investor.id,
      campaignId: investor.campaignId,
      firmName: investor.firmName,
      fitScore: investor.fitScore,
      fitReasons: investor.fitReasons,
      campaignName: campaign?.name,
      note: "No deck attachment or external send is performed in Relay v0.",
    },
  });
}

export async function createRoomRelayInviteRequest(userId: string, roomId: string) {
  const [room] = await db.select().from(rooms).where(and(eq(rooms.id, roomId), eq(rooms.userId, userId))).limit(1);
  if (!room) throw new RelayPolicyError("not_found", "Room not found.");
  return createRelayDraft(userId, {
    requestType: "room_invite",
    recipient: { displayName: "Room guest" },
    goal: `Ask whether they want to join ${room.title}.`,
    context: { roomId: room.id, title: room.title, note: "No guest link is sent externally in Relay v0." },
  });
}

async function getSenderRequest(userId: string, requestId: string): Promise<AgentRequest> {
  const [request] = await db.select().from(agentRequests).where(and(eq(agentRequests.id, requestId), eq(agentRequests.fromUserId, userId))).limit(1);
  if (!request) throw new RelayPolicyError("not_found", "Relay request not found.");
  return request;
}

async function getRecipientRequest(userId: string, requestId: string): Promise<AgentRequest> {
  const [request] = await db.select().from(agentRequests).where(and(eq(agentRequests.id, requestId), eq(agentRequests.toUserId, userId))).limit(1);
  if (!request) throw new RelayPolicyError("not_found", "Relay request not found.");
  return request;
}

async function resolveRecipient(userId: string, recipient: RelayDraftInput["recipient"]) {
  if (recipient?.contactId) {
    const contact = await assertContactOwned(userId, recipient.contactId);
    return { displayName: contact.displayName, toContactId: contact.id, toUserId: contact.contactUserId ?? null };
  }
  const email = recipient?.email?.toLowerCase();
  const [linkedUser] = email ? await db.select().from(users).where(eq(users.email, email)).limit(1) : [];
  if (email || recipient?.displayName) {
    const [contact] = await db
      .insert(trustedContacts)
      .values({
        userId,
        contactUserId: linkedUser?.id ?? null,
        displayName: recipient?.displayName ?? email ?? "Relay contact",
        email: email ?? null,
        status: linkedUser ? "proposed" : "invited",
        trustLevel: "standard",
      })
      .returning();
    if (!contact) throw new Error("failed to create relay contact");
    return { displayName: contact.displayName, toContactId: contact.id, toUserId: linkedUser?.id ?? null };
  }
  throw new RelayPolicyError("not_found", "Relay request needs a recipient.");
}

function safeDraftContext(input: RelayDraftInput): Record<string, unknown> {
  const context = input.context ?? {};
  return {
    campaignId: typeof context.campaignId === "string" ? context.campaignId : undefined,
    investorId: typeof context.investorId === "string" ? context.investorId : undefined,
    roomId: typeof context.roomId === "string" ? context.roomId : undefined,
    note: typeof context.note === "string" ? context.note : undefined,
    source: "relay_v0_safe_context",
  };
}

function buildDraftSummary(input: RelayDraftInput, recipientName: string) {
  const safeGoal = input.goal.replace(/\s+/g, " ").trim();
  const prefix = input.requestType === "investor_interest_check" ? "Ask whether they want to review a short text brief. No deck is attached." : safeGoal;
  return `NearMind proposes asking ${recipientName}: ${prefix}`;
}
