import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { roomParticipants } from "../db/schema.js";
import { hashInviteToken } from "./invite.js";
import { logRoomAuditEvent } from "./audit.js";

export async function setGuestConsent(inviteToken: string, input: { consentStatus: "granted" | "denied"; displayName?: string; email?: string }) {
  const tokenHash = hashInviteToken(inviteToken);
  const [participant] = await db.select().from(roomParticipants).where(eq(roomParticipants.inviteTokenHash, tokenHash)).limit(1);
  if (!participant || participant.role !== "guest") return null;
  const [updated] = await db
    .update(roomParticipants)
    .set({
      consentStatus: input.consentStatus,
      displayName: input.displayName ?? participant.displayName,
      email: input.email ?? participant.email,
      updatedAt: new Date(),
    })
    .where(and(eq(roomParticipants.id, participant.id), eq(roomParticipants.inviteTokenHash, tokenHash)))
    .returning();
  if (updated) {
    await logRoomAuditEvent({
      roomId: updated.roomId,
      userId: updated.userId,
      eventType: input.consentStatus === "granted" ? "guest_consent_granted" : "guest_consent_denied",
      payload: { participantId: updated.id, role: updated.role },
    }).catch(() => null);
  }
  return updated ?? null;
}
