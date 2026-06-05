import type { AgentRequest, AgentRequestMessage, TrustedContact } from "../db/schema.js";

export function safeRequestForUser(request: AgentRequest, viewerUserId: string) {
  const isSender = request.fromUserId === viewerUserId;
  const isRecipient = request.toUserId === viewerUserId;
  return {
    id: request.id,
    requestType: request.requestType,
    title: request.title,
    summary: request.summary,
    requestedShare: request.requestedShare,
    riskLevel: request.riskLevel,
    status: request.status,
    expiresAt: request.expiresAt,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    viewerRole: isSender ? "sender" : isRecipient ? "recipient" : "contact",
    direction: isSender ? "outbox" : isRecipient ? "inbox" : "contact",
    toContactId: isSender ? request.toContactId : undefined,
    context: isSender ? request.context : {},
  };
}

export function safeContact(contact: TrustedContact) {
  return {
    id: contact.id,
    displayName: contact.displayName,
    email: contact.email,
    companyName: contact.companyName,
    relationship: contact.relationship,
    status: contact.status,
    trustLevel: contact.trustLevel,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  };
}

export function safeMessage(message: AgentRequestMessage, viewerUserId: string) {
  return {
    id: message.id,
    requestId: message.requestId,
    role: message.role,
    body: message.safeForRecipient || message.userId === viewerUserId ? message.body : "[redacted]",
    createdAt: message.createdAt,
  };
}
