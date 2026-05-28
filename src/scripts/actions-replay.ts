import WebSocket from "ws";
import { config } from "../config.js";

type Scenario =
  | "draft-email-proposal"
  | "calendar-proposal"
  | "reminder-internal"
  | "connector-registry"
  | "mcp-disabled"
  | "approval-lifecycle"
  | "voice-draft-followup";

const scenario = (process.argv[2] ?? "draft-email-proposal") as Scenario;
const allowed: Scenario[] = ["draft-email-proposal", "calendar-proposal", "reminder-internal", "connector-registry", "mcp-disabled", "approval-lifecycle", "voice-draft-followup"];
if (!allowed.includes(scenario)) throw new Error(`unknown actions replay "${scenario}"`);

const base = `http://${config.HOST === "0.0.0.0" ? "127.0.0.1" : config.HOST}:${config.PORT}`;
const wsBase = base.replace(/^http/, "ws");
const dev = await postJson<{ user: { id: string; email: string }; token: string }>(`${base}/dev/users`, {
  email: `actions-${scenario}@example.com`,
  displayName: "Actions Replay",
});

if (scenario === "draft-email-proposal") {
  const result = await createProposal("draft_email", "Draft follow-up email", { to: "client@example.com", body: "Thanks for meeting.", sendDisabled: true });
  console.log(`draft-email-proposal: ${JSON.stringify(result)}`);
  assertIncludes(JSON.stringify(result), "proposed");
}

if (scenario === "calendar-proposal") {
  const result = await createProposal("propose_calendar_event", "Propose meeting", { title: "Follow-up meeting", createDisabled: true });
  console.log(`calendar-proposal: ${JSON.stringify(result)}`);
  assertIncludes(JSON.stringify(result), "proposed");
}

if (scenario === "reminder-internal") {
  const created = await createProposal("propose_reminder", "Reminder", { title: "Send bank documents", detail: "Internal reminder only", priority: "normal" });
  const id = String((created as { proposal: { id: string } }).proposal.id);
  await postJson(`${base}/actions/proposals/${id}/approve`, { reason: "approved replay" }, dev.token);
  const executed = await postJson(`${base}/actions/proposals/${id}/execute`, {}, dev.token);
  console.log(`reminder-internal: ${JSON.stringify(executed)}`);
  assertIncludes(JSON.stringify(executed), "completed");
}

if (scenario === "connector-registry") {
  const connectors = await getJson(`${base}/connectors`, dev.token);
  const gmail = await getJson(`${base}/connectors/google_gmail/permissions`, dev.token);
  console.log(`connector-registry: ${JSON.stringify({ connectors, gmail })}`);
  assertIncludes(JSON.stringify(connectors), "google_gmail");
}

if (scenario === "mcp-disabled") {
  const permissions = await getJson(`${base}/connectors/mcp_remote/permissions`, dev.token);
  console.log(`mcp-disabled: ${JSON.stringify(permissions)}`);
  assertIncludes(JSON.stringify(permissions), "mcp_network_disabled_by_default");
}

if (scenario === "approval-lifecycle") {
  const created = await createProposal("propose_reminder", "Approval lifecycle reminder", { title: "Review lifecycle" });
  const id = String((created as { proposal: { id: string } }).proposal.id);
  const approved = await postJson(`${base}/actions/proposals/${id}/approve`, { reason: "replay approved" }, dev.token);
  const detail = await getJson(`${base}/actions/proposals/${id}`, dev.token);
  console.log(`approval-lifecycle: ${JSON.stringify({ approved, detail })}`);
  assertIncludes(JSON.stringify(detail), "approved");
}

if (scenario === "voice-draft-followup") {
  const events = await runVoiceDraftFollowup(dev.token);
  const proposals = await getJson(`${base}/actions/proposals`, dev.token);
  console.log(`voice-draft-followup: ${JSON.stringify({ events, proposals })}`);
  assertIncludes(JSON.stringify(events), "draft-only action proposal");
  assertIncludes(JSON.stringify(proposals), "draft_email");
}

async function createProposal(actionType: string, title: string, payload: Record<string, unknown>) {
  return postJson(
    `${base}/actions/proposals`,
    {
      sourceType: "manual",
      actionType,
      title,
      description: `${title}. Review required. No external action is taken.`,
      payload,
    },
    dev.token,
  );
}

async function runVoiceDraftFollowup(token: string) {
  const ws = new WebSocket(`${wsBase}/voice?token=${encodeURIComponent(token)}`);
  const events = collectEvents(ws);
  await open(ws);
  ws.send(
    JSON.stringify({
      type: "start",
      protocolVersion: 1,
      policy: "conversation_agent",
      situationDescription: "I met a client about pricing.",
      consent: { granted: true, method: "user_tap", noticeText: "Live Assist is active.", participantCount: 1 },
      input: { kind: "text" },
      output: { kind: "text" },
      retentionPolicy: "ask_on_stop",
    }),
  );
  await waitFor(events, "voice_ack");
  ws.send(JSON.stringify({ type: "user_text", text: "Draft follow-up email to the client about pricing." }));
  await waitFor(events, "voice_assistant_text");
  ws.send(JSON.stringify({ type: "stop", save: false }));
  await delay(250);
  ws.close();
  return events.items;
}

function collectEvents(ws: WebSocket) {
  const items: Array<{ type: string; [key: string]: unknown }> = [];
  ws.on("message", (data) => items.push(JSON.parse(data.toString())));
  return { items };
}

function open(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
}

async function waitFor(events: { items: Array<{ type: string; [key: string]: unknown }> }, type: string, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const event = events.items.find((item) => item.type === type);
    if (event) return event;
    await delay(50);
  }
  throw new Error(`timed out waiting for ${type}: ${JSON.stringify(events.items)}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertIncludes(text: string, expected: string): void {
  if (!text.includes(expected)) throw new Error(`expected output to include ${expected}: ${text}`);
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
