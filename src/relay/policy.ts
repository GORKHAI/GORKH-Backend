import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { agentBlocks, agentRequests, trustedContacts } from "../db/schema.js";
export { RelayPolicyError, assertNoMassBroadcast, assertNoPrivateDataSharing, assertRequestTypeAllowed, relayErrorStatus } from "./policy-core.js";
import { RelayPolicyError } from "./policy-core.js";

export async function assertSenderRateLimit(userId: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(agentRequests)
    .where(and(eq(agentRequests.fromUserId, userId), gte(agentRequests.createdAt, since)));
  if (Number(row?.count ?? 0) >= 20) throw new RelayPolicyError("rate_limited", "Relay request rate limit reached.");
}

export async function assertContactOwned(userId: string, contactId: string) {
  const [contact] = await db.select().from(trustedContacts).where(and(eq(trustedContacts.id, contactId), eq(trustedContacts.userId, userId))).limit(1);
  if (!contact) throw new RelayPolicyError("not_found", "Trusted contact not found.");
  if (contact.status === "blocked" || contact.status === "removed") throw new RelayPolicyError("blocked", "This contact is blocked or removed.");
  return contact;
}

export async function isBlockedByRecipient(args: { senderUserId: string; recipientUserId?: string | null; recipientEmail?: string | null }) {
  if (!args.recipientUserId && !args.recipientEmail) return false;
  const rows = await db
    .select()
    .from(agentBlocks)
    .where(
      args.recipientUserId
        ? and(eq(agentBlocks.userId, args.recipientUserId), eq(agentBlocks.blockedUserId, args.senderUserId))
        : and(eq(agentBlocks.userId, args.senderUserId), eq(agentBlocks.blockedEmail, args.recipientEmail ?? "")),
    )
    .limit(1);
  return rows.length > 0;
}
