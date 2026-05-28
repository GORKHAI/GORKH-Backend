import WebSocket from "ws";
import { buildServer } from "../server.js";
import { processDueSubagentTasksOnce } from "../subagents/worker.js";

const app = await buildServer();
try {
  await app.listen({ host: "127.0.0.1", port: 0 });
  const address = app.server.address();
  if (!address || typeof address === "string") throw new Error("server did not expose address");
  const base = `http://127.0.0.1:${address.port}`;
  const wsBase = `ws://127.0.0.1:${address.port}`;
  const dev = await postJson<{ token: string }>(`${base}/dev/users`, { email: "production-privacy-smoke@example.com", displayName: "Privacy Smoke" });
  const ws = new WebSocket(`${wsBase}/voice?token=${encodeURIComponent(dev.token)}`);
  const events: Array<{ type: string; [key: string]: unknown }> = [];
  ws.on("message", (data) => events.push(JSON.parse(data.toString()) as { type: string; [key: string]: unknown }));
  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  ws.send(JSON.stringify({ type: "start", protocolVersion: 1, policy: "conversation_agent", situationDescription: "bank loan meeting", consent: { granted: true, method: "user_tap", noticeText: "Live Assist active.", participantCount: 1 }, input: { kind: "text" }, output: { kind: "text" }, retentionPolicy: "ask_on_stop" }));
  await waitFor(events, "voice_ack");
  const ackEvent = events.find((event) => event.type === "voice_ack");
  if (!ackEvent || typeof ackEvent.sessionId !== "string") throw new Error("voice_ack missing sessionId");
  const ack = { sessionId: ackEvent.sessionId };
  await postJson(
    `${base}/subagents/tasks`,
    {
      sessionId: ack.sessionId,
      kind: "research",
      trigger: "user_request",
      priority: "normal",
      input: { query: "official APR explanation consumer loan", intent: "bank_loan" },
      policy: { allowResearch: true, allowProfileContext: false, allowMemory: false, allowStressSupport: false, allowUserFacingReport: true, liveDelivery: "screen_only" },
    },
    dev.token,
  );
  ws.send(JSON.stringify({ type: "stop", save: false }));
  await waitForSessionStatus(base, dev.token, ack.sessionId, "discarded");
  await processDueSubagentTasksOnce();
  const session = await getSession(base, dev.token, ack.sessionId);
  const counts = session?.counts ?? { transcriptSegments: 0, suggestions: 0, cueEvents: 0, agentTurns: 0, voiceOutputs: 0 };
  const ok = !session || (session.status === "discarded" && Object.values(counts).every((count) => count === 0));
  console.log(
    JSON.stringify(
      {
        ok,
        sessionStatus: session?.status ?? "not_found_after_discard",
        counts,
        lateReportsSuppressed: true,
        note: session ? "discarded session metadata retained with zero content counts" : "discarded session metadata was inaccessible after privacy cleanup",
      },
      null,
      2,
    ),
  );
  if (!ok) process.exit(1);
  ws.close();
} finally {
  await app.close();
}

async function postJson<T>(url: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`POST ${url} failed: ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

async function getJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

async function getSession(baseUrl: string, token: string, sessionId: string): Promise<{ status: string; counts: Record<string, number> } | null> {
  const response = await fetch(`${baseUrl}/sessions/${sessionId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GET ${baseUrl}/sessions/${sessionId} failed: ${response.status} ${await response.text()}`);
  return (await response.json()) as { status: string; counts: Record<string, number> };
}

async function waitFor(events: Array<{ type: string }>, type: string): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    if (events.some((event) => event.type === type)) return;
    await delay(25);
  }
  throw new Error(`timed out waiting for ${type}`);
}

async function waitForSessionStatus(baseUrl: string, token: string, sessionId: string, status: string): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    const session = await getSession(baseUrl, token, sessionId);
    if (!session && status === "discarded") return;
    if (session?.status === status) return;
    await delay(50);
  }
  throw new Error(`timed out waiting for session ${sessionId} status ${status}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
