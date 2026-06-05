import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { agentBlocks, investorProfiles, outreachCampaigns, users } from "../db/schema.js";
import { createMobileNotification, mobileSync } from "../mobile/notifications.js";
import {
  approveRelaySend,
  createInvestorRelayRequest,
  createRelayContact,
  createRelayDraft,
  decideIncomingRelayRequest,
  getOrCreateRelayIdentity,
} from "../relay/service.js";

type RelayReplayName =
  | "identity"
  | "contact-create"
  | "request-draft"
  | "approve-send-existing-user"
  | "receiver-approve"
  | "receiver-reject"
  | "block-sender"
  | "mobile-sync"
  | "investor-relay-request";

export const relayReplayScenarios: RelayReplayName[] = [
  "identity",
  "contact-create",
  "request-draft",
  "approve-send-existing-user",
  "receiver-approve",
  "receiver-reject",
  "block-sender",
  "mobile-sync",
  "investor-relay-request",
];

async function main() {
  const name = (process.argv[2] ?? "identity") as RelayReplayName;
  if (!relayReplayScenarios.includes(name)) throw new Error(`unknown relay replay "${name}"`);
  await runRelayReplay(name);
}

export async function runRelayReplay(name: RelayReplayName) {
  const sender = await getReplayUser("relay-sender@gorkh.dev", "Relay Sender");
  const receiver = await getReplayUser("relay-receiver@gorkh.dev", "Relay Receiver");
  await clearReplayBlock(sender.id, receiver.id);
  if (name === "identity") {
    const identity = await getOrCreateRelayIdentity(sender.id);
    if (!identity.relayEnabled) throw new Error("relay identity disabled unexpectedly");
    console.log("relay identity: passed");
    return;
  }
  if (name === "contact-create") {
    const contact = await createRelayContact(sender.id, { displayName: "Relay Receiver", email: receiver.email, trustLevel: "standard" });
    if (contact.contactUserId !== receiver.id) throw new Error("contact did not link existing NearMind user");
    console.log("relay contact-create: passed");
    return;
  }
  if (name === "request-draft") {
    const request = await draftForReceiver(sender.id, receiver.email);
    if (request.status !== "pending_sender_approval") throw new Error(`draft status invalid: ${request.status}`);
    console.log("relay request-draft: passed");
    return;
  }
  if (name === "approve-send-existing-user") {
    const request = await draftForReceiver(sender.id, receiver.email);
    const sent = await approveRelaySend(sender.id, request.id);
    if (sent.externalEmailSent) throw new Error("relay v0 sent external email");
    if (sent.request.status !== "sent" || sent.request.toUserId !== receiver.id) throw new Error("approve-send did not target existing user");
    console.log("relay approve-send-existing-user: passed");
    return;
  }
  if (name === "receiver-approve") {
    const sent = await sendToReceiver(sender.id, receiver.email);
    const approved = await decideIncomingRelayRequest(receiver.id, sent.id, "approve", { approvedPayload: { reply: "Yes, next Tuesday works." } });
    if (approved.request.status !== "approved") throw new Error("receiver approve failed");
    console.log("relay receiver-approve: passed");
    return;
  }
  if (name === "receiver-reject") {
    const sent = await sendToReceiver(sender.id, receiver.email);
    const rejected = await decideIncomingRelayRequest(receiver.id, sent.id, "reject", { reason: "Not relevant." });
    if (rejected.request.status !== "rejected") throw new Error("receiver reject failed");
    console.log("relay receiver-reject: passed");
    return;
  }
  if (name === "block-sender") {
    const sent = await sendToReceiver(sender.id, receiver.email);
    const blocked = await decideIncomingRelayRequest(receiver.id, sent.id, "block", { reason: "Replay block." });
    if (blocked.request.status !== "blocked") throw new Error("receiver block failed");
    console.log("relay block-sender: passed");
    return;
  }
  if (name === "mobile-sync") {
    const sent = await sendToReceiver(sender.id, receiver.email);
    await createMobileNotification({ userId: receiver.id, type: "relay_request_received", title: "Relay replay", payload: { requestId: sent.id } });
    const sync = await mobileSync(receiver.id, { limit: 50 });
    if (!sync.items.some((item) => item.type.startsWith("relay_"))) throw new Error("mobile sync missing relay items");
    console.log("relay mobile-sync: passed");
    return;
  }
  if (name === "investor-relay-request") {
    const investor = await createReplayInvestor(sender.id);
    const draft = await createInvestorRelayRequest(sender.id, investor.id);
    if (draft.requestType !== "investor_interest_check" || JSON.stringify(draft.context).includes("deckAttachment")) throw new Error("investor relay draft unsafe");
    console.log("relay investor-relay-request: passed");
    return;
  }
}

async function clearReplayBlock(senderUserId: string, receiverUserId: string) {
  await db.delete(agentBlocks).where(and(eq(agentBlocks.userId, receiverUserId), eq(agentBlocks.blockedUserId, senderUserId)));
}

async function draftForReceiver(userId: string, email: string) {
  return createRelayDraft(userId, {
    requestType: "meeting_request",
    recipient: { displayName: "Relay Receiver", email },
    goal: "Ask whether next week works for an investor call.",
    context: { source: "relay_replay" },
  });
}

async function sendToReceiver(userId: string, email: string) {
  const request = await draftForReceiver(userId, email);
  return (await approveRelaySend(userId, request.id)).request;
}

async function getReplayUser(email: string, displayName: string) {
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return existing;
  const [user] = await db.insert(users).values({ email, displayName }).returning();
  if (!user) throw new Error("failed to create relay replay user");
  return user;
}

async function createReplayInvestor(userId: string) {
  const [campaign] = await db
    .insert(outreachCampaigns)
    .values({
      userId,
      name: "Relay replay raise",
      startupSummary: "Private professional AI assistant.",
      status: "draft",
    })
    .returning();
  if (!campaign) throw new Error("failed to create replay campaign");
  const [investor] = await db
    .insert(investorProfiles)
    .values({
      userId,
      campaignId: campaign.id,
      firmName: "Replay Ventures",
      partnerName: "Replay Partner",
      email: "relay-investor@example.com",
      status: "discovered",
      fitScore: 0.8,
      fitReasons: ["AI tooling fit"],
    })
    .returning();
  if (!investor) throw new Error("failed to create replay investor");
  return investor;
}

if (process.argv[1]?.endsWith("relay-replay.ts") || process.argv[1]?.endsWith("relay-replay.js")) {
  main().catch((err) => {
    console.error(`relay:replay failed: ${(err as Error).message}`);
    process.exit(1);
  });
}
