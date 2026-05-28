import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { commitments, providerUsageEvents, sessions, users } from "../db/schema.js";
import { validateGatewayProtocolVersion, validateVoiceProtocolVersion } from "../protocol/mobile-contract.js";
import { mobileError } from "../protocol/errors.js";
import { decideProfileMutation } from "../human/profile-mutation-gate.js";
import { governorBudgetStatus, recordProviderUsage } from "../governor/budget.js";
import { createMobileNotification, ackMobileNotification, listMobileNotifications, mobileSync } from "../mobile/notifications.js";
import { extractCommitmentsFromText } from "../daily/commitment-extractor.js";
import { recordVoiceLatencyEvent, latencySummaryForSession } from "../voice/latency.js";

type ReplayName =
  | "protocol-version"
  | "error-codes"
  | "reconnect-state"
  | "profile-mutation-gate"
  | "research-citation-details"
  | "governor-budget"
  | "notification-sync"
  | "duplicate-task-suppression"
  | "latency-summary";

const all: ReplayName[] = [
  "protocol-version",
  "error-codes",
  "reconnect-state",
  "profile-mutation-gate",
  "research-citation-details",
  "governor-budget",
  "notification-sync",
  "duplicate-task-suppression",
  "latency-summary",
];

async function main(): Promise<void> {
  const name = (process.argv[2] ?? "protocol-version") as ReplayName;
  if (!all.includes(name)) throw new Error(`unknown mobile replay "${name}"`);
  await run(name);
}

export async function run(name: ReplayName): Promise<void> {
  if (name === "protocol-version") {
    if (!validateVoiceProtocolVersion(1).ok || !validateGatewayProtocolVersion(1).ok) throw new Error("protocol v1 rejected");
    if (!validateVoiceProtocolVersion(undefined).warning || !validateGatewayProtocolVersion(undefined).warning) throw new Error("missing protocol warning not emitted");
    if (validateVoiceProtocolVersion(99).ok || validateGatewayProtocolVersion(99).ok) throw new Error("unsupported protocol accepted");
    console.log("protocol-version: passed");
    return;
  }
  if (name === "error-codes") {
    const err = mobileError("unsupported_protocol_version", "Unsupported protocol version.");
    if (err.code !== "unsupported_protocol_version" || err.retryable !== false || !err.details) throw new Error("stable error shape invalid");
    console.log("error-codes: passed");
    return;
  }
  if (name === "profile-mutation-gate") {
    if (decideProfileMutation({ text: "I am a blockchain developer", allowProfileMutation: false }).allowed) throw new Error("casual profile mutation allowed");
    if (!decideProfileMutation({ text: "Remember that I am a blockchain developer", allowProfileMutation: true }).allowed) throw new Error("explicit remember blocked");
    console.log("profile-mutation-gate: passed");
    return;
  }

  const user = await getReplayUser();
  if (name === "governor-budget") {
    await db.delete(providerUsageEvents).where(eq(providerUsageEvents.userId, user.id));
    await recordProviderUsage({ userId: user.id, provider: "deepseek", model: "deepseek-v4-flash", operation: "voice_agent.complete_text", status: "completed" });
    const status = await governorBudgetStatus(user.id);
    if (status.llmRequestsUsed < 1) throw new Error("today LLM usage not counted");
    console.log(`governor-budget: llmRequestsUsed=${status.llmRequestsUsed}`);
    return;
  }
  if (name === "notification-sync") {
    const notification = await createMobileNotification({ userId: user.id, type: "mobile_replay", title: "Replay notification", payload: { replay: true } });
    const listed = await listMobileNotifications(user.id, { limit: 10 });
    if (!listed.items.some((item) => item.id === notification.id)) throw new Error("notification missing from cursor list");
    const acked = await ackMobileNotification(user.id, notification.id);
    if (!acked?.acknowledgedAt) throw new Error("notification ack failed");
    const sync = await mobileSync(user.id, { limit: 20 });
    if (!sync.items.some((item) => item.type === "notification")) throw new Error("mobile sync missing notification item");
    console.log("notification-sync: passed");
    return;
  }
  if (name === "duplicate-task-suppression") {
    const extracted = extractCommitmentsFromText({ text: "I need to send the bank documents by Friday. I need to send the bank documents by Friday.", sourceType: "manual" });
    if (extracted.length !== 1 || !extracted[0]?.whySuggested || !extracted[0]?.sourceQuote || !extracted[0]?.dedupeKey) throw new Error("duplicate/explainability extraction failed");
    console.log("duplicate-task-suppression: passed");
    return;
  }
  if (name === "latency-summary" || name === "reconnect-state") {
    const session = await createReplaySession(user.id);
    if (name === "reconnect-state") {
      const [row] = await db.select().from(sessions).where(and(eq(sessions.id, session.id), eq(sessions.userId, user.id))).limit(1);
      if (!row || row.status !== "active") throw new Error("session state lookup failed");
      console.log("reconnect-state: passed");
      return;
    }
    const t0 = new Date();
    await recordVoiceLatencyEvent({ userId: user.id, sessionId: session.id, eventType: "transcript_received", speechId: "s1", timestamp: t0 });
    await recordVoiceLatencyEvent({ userId: user.id, sessionId: session.id, eventType: "cue_generated", speechId: "s1", timestamp: new Date(t0.getTime() + 100) });
    await recordVoiceLatencyEvent({ userId: user.id, sessionId: session.id, eventType: "gateway_instruction", speechId: "s1", timestamp: new Date(t0.getTime() + 140) });
    const summary = await latencySummaryForSession(user.id, session.id);
    if (summary.asrToCueMs !== 100 || summary.cueToGatewayInstructionMs !== 40) throw new Error(`latency summary invalid: ${JSON.stringify(summary)}`);
    console.log("latency-summary: passed");
    return;
  }
  if (name === "research-citation-details") {
    console.log("research-citation-details: API-backed citation detail paths are covered by integration/live verification; replay scenario is non-mutating.");
    return;
  }
}

async function getReplayUser() {
  const email = "mobile-replay@gorkh.dev";
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return existing;
  const [user] = await db.insert(users).values({ email, displayName: "Mobile Replay" }).returning();
  if (!user) throw new Error("failed to create mobile replay user");
  return user;
}

async function createReplaySession(userId: string) {
  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      internalType: "bank_loan",
      status: "active",
      title: `mobile replay ${randomUUID()}`,
      consentGranted: true,
      retentionPolicy: "discard_on_stop",
    })
    .returning();
  if (!session) throw new Error("failed to create replay session");
  return session;
}

if (process.argv[1]?.endsWith("mobile-replay.ts") || process.argv[1]?.endsWith("mobile-replay.js")) {
  main().catch((err) => {
    console.error(`mobile:replay failed: ${(err as Error).message}`);
    process.exit(1);
  });
}
