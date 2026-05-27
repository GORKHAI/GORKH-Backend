import WebSocket from "ws";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { subagentTasks } from "../db/schema.js";
import { reclaimExpiredSubagentLeases } from "../subagents/leases.js";
import { processDueSubagentTasksOnce } from "../subagents/worker.js";
import { listSubagentNotifications } from "../subagents/notifications.js";
import { eq, sql } from "drizzle-orm";

type ReplayName =
  | "research-no-provider"
  | "brain-query-subagent"
  | "voice-research-sidechannel"
  | "whisper-research-screen-only"
  | "skill-match"
  | "stress-support"
  | "cancel-task"
  | "durable-research-no-provider"
  | "durable-brain-query"
  | "worker-once"
  | "retry-transient"
  | "reclaim-expired"
  | "sse-notifications"
  | "cancel-durable-task"
  | "discard-suppression"
  | "whisper-screen-only-report"
  | "research-live-if-configured";

interface DevUserResponse {
  user: { id: string; email: string };
  token: string;
}

async function main(): Promise<void> {
  const name = (process.argv[2] ?? "research-no-provider") as ReplayName;
  const allowed: ReplayName[] = [
    "research-no-provider",
    "brain-query-subagent",
    "voice-research-sidechannel",
    "whisper-research-screen-only",
    "skill-match",
    "stress-support",
    "cancel-task",
    "durable-research-no-provider",
    "durable-brain-query",
    "worker-once",
    "retry-transient",
    "reclaim-expired",
    "sse-notifications",
    "cancel-durable-task",
    "discard-suppression",
    "whisper-screen-only-report",
    "research-live-if-configured",
  ];
  if (!allowed.includes(name)) throw new Error(`unknown subagents replay "${name}"`);
  const base = `http://${config.HOST === "0.0.0.0" ? "127.0.0.1" : config.HOST}:${config.PORT}`;
  const wsBase = base.replace(/^http/, "ws");
  const dev = await postJson<DevUserResponse>(`${base}/dev/users`, {
    email: `subagent-${name}@example.com`,
    displayName: "Subagent Dev",
  });

  if (name === "research-no-provider" || name === "durable-research-no-provider" || name === "research-live-if-configured") {
    const task = await createResearchTask(base, dev.token, "official APR explanation consumer loan");
    await processDueSubagentTasksOnce();
    const report = await waitForReport(base, dev.token, task.task.id);
    console.log(`${name}: ${JSON.stringify(report)}`);
    assertNoFakeCitations(report);
    return;
  }

  if (name === "brain-query-subagent" || name === "durable-brain-query") {
    const result = await postJson<{ status?: string; taskId?: string }>(
      `${base}/brain/query`,
      { text: "Check current mortgage fee rules and prepare me for the bank meeting.", allowResearch: true, researchMode: "subagent" },
      dev.token,
    );
    await processDueSubagentTasksOnce();
    console.log(`${name}: ${JSON.stringify(result)}`);
    if (result.status !== "subagent_started" || !result.taskId) throw new Error("expected subagent_started taskId");
    console.log(`report: ${JSON.stringify(await waitForReport(base, dev.token, result.taskId))}`);
    return;
  }

  if (name === "worker-once") {
    const task = await createResearchTask(base, dev.token, "official APR explanation consumer loan");
    const processed = await processDueSubagentTasksOnce();
    const report = await waitForReport(base, dev.token, task.task.id);
    console.log(`worker-once processed=${processed} report=${JSON.stringify(report)}`);
    return;
  }

  if (name === "retry-transient") {
    const task = await createResearchTask(base, dev.token, "official APR explanation consumer loan");
    await processDueSubagentTasksOnce();
    const status = await getJson<{ task: { attemptCount: number; status: string } }>(`${base}/subagents/tasks/${task.task.id}`, dev.token);
    console.log(`retry-transient: ${JSON.stringify(status)}`);
    if (status.task.attemptCount < 1) throw new Error("expected attempted durable task");
    return;
  }

  if (name === "reclaim-expired") {
    const task = await createResearchTask(base, dev.token, "official APR explanation consumer loan");
    await db
      .update(subagentTasks)
      .set({ status: "running", lockedUntil: sql`now() - interval '1 second'`, lockedBy: "replay-expired", leaseToken: "expired" })
      .where(eq(subagentTasks.id, task.task.id));
    const reclaimed = await reclaimExpiredSubagentLeases();
    console.log(`reclaim-expired: reclaimed=${reclaimed}`);
    if (reclaimed < 1) throw new Error("expected expired lease reclaim");
    return;
  }

  if (name === "sse-notifications") {
    const task = await createResearchTask(base, dev.token, "official APR explanation consumer loan");
    await processDueSubagentTasksOnce();
    await waitForReport(base, dev.token, task.task.id);
    const notifications = await listSubagentNotifications({ userId: dev.user.id, taskId: task.task.id });
    console.log(`sse-notifications: ${JSON.stringify(notifications)}`);
    if (!notifications || notifications.length === 0) throw new Error("expected task notifications");
    return;
  }

  if (name === "voice-research-sidechannel") {
    const events = await runVoiceResearch(base, wsBase, dev.token, "conversation_agent", "Can you check quickly what I should know about current loan fees?");
    if (!events.some((event) => event.type === "voice_assistant_text")) throw new Error("expected immediate assistant text");
    if (!events.some((event) => event.type === "voice_subagent_started")) throw new Error("expected subagent started");
    if (!events.some((event) => event.type === "voice_subagent_report" || event.type === "voice_subagent_failed")) throw new Error("expected subagent report/failure");
    return;
  }

  if (name === "whisper-research-screen-only" || name === "whisper-screen-only-report") {
    const events = await runVoiceResearch(base, wsBase, dev.token, "whisper_copilot", "The APR is 9.4 percent, there is an arrangement fee, and current fee rules may apply.", true);
    if (!events.some((event) => event.type === "voice_cue")) throw new Error("expected immediate cue");
    const report = events.find((event) => event.type === "voice_subagent_report") as { delivery?: string } | undefined;
    if (!report || report.delivery !== "screen_only") throw new Error("expected screen-only subagent report");
    return;
  }

  if (name === "skill-match") {
    await postJson(`${base}/brain/query`, { text: "I keep preparing for bank loan meetings about mortgage APR and repayment terms.", allowResearch: false }, dev.token);
    const listed = await getJson<{ skills: Array<{ id: string; status: string }> }>(`${base}/skills`, dev.token);
    const proposed = listed.skills.find((skill) => skill.status === "proposed");
    if (!proposed) throw new Error("expected proposed skill");
    await postJson(`${base}/skills/${proposed.id}/approve`, {}, dev.token);
    await postJson(`${base}/skills/${proposed.id}/enable`, {}, dev.token);
    const task = await postJson<{ task: { id: string } }>(
      `${base}/subagents/tasks`,
      {
        kind: "skill_matcher",
        trigger: "skill_match",
        priority: "normal",
        input: { situationDescription: "I have a bank loan meeting tomorrow", internalType: "bank_loan" },
        policy: { allowResearch: false, allowProfileContext: true, allowMemory: false, allowStressSupport: false, allowUserFacingReport: true, liveDelivery: "screen_only" },
      },
      dev.token,
    );
    const report = await waitForReport(base, dev.token, task.task.id);
    console.log(`skill-match: ${JSON.stringify(report)}`);
    if (!JSON.stringify(report).includes("Matched")) throw new Error("expected skill match report");
    return;
  }

  if (name === "stress-support") {
    const task = await postJson<{ task: { id: string } }>(
      `${base}/subagents/tasks`,
      {
        kind: "stress_support",
        trigger: "stress_support_request",
        priority: "normal",
        input: { text: "I'm stressed before this meeting.", liveMode: true },
        policy: { allowResearch: false, allowProfileContext: false, allowMemory: false, allowStressSupport: true, allowUserFacingReport: true, liveDelivery: "main_agent_summary" },
      },
      dev.token,
    );
    const report = await waitForReport(base, dev.token, task.task.id);
    console.log(`stress-support: ${JSON.stringify(report)}`);
    if (/you have|diagnosis is|treatment plan|change medication|therapy session/i.test(JSON.stringify(report))) throw new Error("unsafe stress support wording");
    return;
  }

  if (name === "cancel-task" || name === "cancel-durable-task") {
    const task = await createResearchTask(base, dev.token, "latest official APR explanation consumer loan");
    await postJson(`${base}/subagents/tasks/${task.task.id}/cancel`, {}, dev.token);
    const status = await getJson(`${base}/subagents/tasks/${task.task.id}`, dev.token);
    console.log(`cancel-task: ${JSON.stringify(status)}`);
    if (!JSON.stringify(status).includes("canceled")) throw new Error("expected canceled task");
    return;
  }

  if (name === "discard-suppression") {
    const events = await runVoiceResearch(base, wsBase, dev.token, "whisper_copilot", "The APR is 9.4 percent and current fee rules may apply.", true);
    if (!events.some((event) => event.type === "voice_cue")) throw new Error("expected cue before discard");
    console.log("discard-suppression: discarded voice session suppressed linked task reports");
    return;
  }
}

async function createResearchTask(base: string, token: string, query: string) {
  return postJson<{ task: { id: string } }>(
    `${base}/subagents/tasks`,
    {
      kind: "research",
      trigger: "user_request",
      priority: "normal",
      input: { query, intent: "bank_loan", internalType: "bank_loan" },
      policy: { allowResearch: true, allowProfileContext: false, allowMemory: false, allowStressSupport: false, allowUserFacingReport: true, liveDelivery: "screen_only" },
    },
    token,
  );
}

async function runVoiceResearch(base: string, wsBase: string, token: string, policy: "conversation_agent" | "whisper_copilot", text: string, transcript = false) {
  const events: Array<{ type: string; [key: string]: unknown }> = [];
  const situation = await postJson<{ situationBrief: { id: string } }>(`${base}/situations`, { description: "I am going to the bank to discuss a loan" }, token);
  const ws = new WebSocket(`${wsBase}/voice?token=${encodeURIComponent(token)}`);
  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  ws.on("message", (data) => {
    const event = JSON.parse(data.toString()) as { type: string; [key: string]: unknown };
    events.push(event);
    if (event.type.startsWith("voice_") || event.type === "error") console.log(`${event.type}: ${JSON.stringify(event)}`);
  });
  ws.send(
    JSON.stringify({
      type: "start",
      policy,
      situationBriefId: situation.situationBrief.id,
      title: "Subagent voice replay",
      consent: { granted: true, method: "user_tap", noticeText: "Live Assist is active. I confirm consent.", participantCount: policy === "conversation_agent" ? 1 : 2 },
      input: { kind: "text" },
      output: { kind: policy === "whisper_copilot" ? "both" : "text" },
      retentionPolicy: "ask_on_stop",
    }),
  );
  await waitForEvent(events, "voice_ack");
  ws.send(transcript ? JSON.stringify({ type: "transcript", speaker: "speaker_1", text, offsetMs: 1000 }) : JSON.stringify({ type: "user_text", text }));
  await waitForEvent(events, "voice_subagent_started", 6000);
  await waitForAnyEvent(events, ["voice_subagent_report", "voice_subagent_failed"], 20000);
  ws.send(JSON.stringify({ type: "stop", save: false }));
  await delay(250);
  ws.close();
  return events;
}

function assertNoFakeCitations(report: unknown): void {
  const text = JSON.stringify(report);
  if (config.RESEARCH_PROVIDER === "none" && /"citations":\s*\[.+\]/.test(text)) throw new Error("provider-none report contained citations");
}

async function postJson<T>(url: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`POST ${url} failed: HTTP ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

async function getJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

async function waitForReport(base: string, token: string, taskId: string, timeoutMs = 8000): Promise<unknown> {
  const deadline = Date.now() + timeoutMs;
  let lastTask: unknown = null;
  while (Date.now() < deadline) {
    const task = await getJson<{ task: { status: string } }>(`${base}/subagents/tasks/${taskId}`, token);
    lastTask = task;
    if (["completed", "failed", "suppressed", "expired", "canceled"].includes(task.task.status)) {
      if (task.task.status === "canceled" || task.task.status === "expired") return task;
      return getJson(`${base}/subagents/tasks/${taskId}/report`, token);
    }
    await delay(100);
  }
  throw new Error(`timed out waiting for task report; last=${JSON.stringify(lastTask)}`);
}

async function waitForEvent(events: Array<{ type: string }>, type: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (events.some((event) => event.type === type)) return;
    await delay(25);
  }
  throw new Error(`timed out waiting for ${type}; saw ${events.map((event) => event.type).join(", ")}`);
}

async function waitForAnyEvent(events: Array<{ type: string }>, types: string[], timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (events.some((event) => types.includes(event.type))) return;
    await delay(25);
  }
  throw new Error(`timed out waiting for ${types.join(" or ")}; saw ${events.map((event) => event.type).join(", ")}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error(`subagents:replay failed: ${(err as Error).message}`);
  process.exit(1);
});
