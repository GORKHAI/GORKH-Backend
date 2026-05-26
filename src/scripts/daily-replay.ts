import WebSocket from "ws";
import { config } from "../config.js";

type Scenario =
  | "extract-commitments"
  | "task-inbox"
  | "daily-brief"
  | "meeting-prep-pack"
  | "meeting-recap-pack"
  | "voice-open-commitments"
  | "discard-no-extraction";

interface DevUserResponse {
  user: { id: string; email: string };
  token: string;
}

const scenario = (process.argv[2] ?? "extract-commitments") as Scenario;
const allowed: Scenario[] = ["extract-commitments", "task-inbox", "daily-brief", "meeting-prep-pack", "meeting-recap-pack", "voice-open-commitments", "discard-no-extraction"];
if (!allowed.includes(scenario)) throw new Error(`unknown daily replay "${scenario}"`);

const base = `http://${config.HOST === "0.0.0.0" ? "127.0.0.1" : config.HOST}:${config.PORT}`;
const wsBase = base.replace(/^http/, "ws");
const dev = await postJson<DevUserResponse>(`${base}/dev/users`, { email: `daily-${scenario}@example.com`, displayName: "Daily Replay" });

if (scenario === "extract-commitments") {
  const result = await postJson(`${base}/daily/commitments/propose`, { text: "I will send the bank documents by Friday and follow up next week.", sourceType: "manual" }, dev.token);
  console.log(`extract-commitments: ${JSON.stringify(result)}`);
  assertIncludes(JSON.stringify(result), "proposed");
}

if (scenario === "task-inbox") {
  await postJson(`${base}/daily/commitments/propose`, { text: "I need to prepare pricing notes by Friday.", sourceType: "manual" }, dev.token);
  const tasks = await getJson(`${base}/daily/tasks`, dev.token);
  console.log(`task-inbox: ${JSON.stringify(tasks)}`);
  assertIncludes(JSON.stringify(tasks), "proposed");
}

if (scenario === "daily-brief") {
  await postJson(`${base}/daily/commitments/propose`, { text: "I need to follow up with the client tomorrow.", sourceType: "manual" }, dev.token);
  const brief = await postJson(`${base}/daily/brief/generate`, {}, dev.token);
  console.log(`daily-brief: ${JSON.stringify(brief)}`);
  assertIncludes(JSON.stringify(brief), "Today's priorities");
}

if (scenario === "meeting-prep-pack") {
  const pack = await postJson(`${base}/meetings/prep-pack`, { situationDescription: "I am going to the bank to discuss a loan." }, dev.token);
  console.log(`meeting-prep-pack: ${JSON.stringify(pack)}`);
  assertIncludes(JSON.stringify(pack), "APR");
}

if (scenario === "meeting-recap-pack") {
  const sessionId = await runVoiceSession(dev.token, true, "We agreed to send the repayment documents by Friday. Follow up next week with the bank.");
  const pack = await postJson(`${base}/meetings/recap-pack`, { sessionId }, dev.token);
  console.log(`meeting-recap-pack: ${JSON.stringify(pack)}`);
  assertIncludes(JSON.stringify(pack), "recap");
}

if (scenario === "voice-open-commitments") {
  await postJson(`${base}/daily/commitments/propose`, { text: "I need to send the bank documents by Friday.", sourceType: "manual" }, dev.token);
  const events = await runVoiceQuestion(dev.token, "What did I promise?");
  console.log(`voice-open-commitments: ${JSON.stringify(events)}`);
  assertIncludes(JSON.stringify(events), "Open commitments");
}

if (scenario === "discard-no-extraction") {
  const sessionId = await runVoiceSession(dev.token, false, "I will send the bank documents by Friday.");
  const commitments = await getJson(`${base}/daily/commitments`, dev.token);
  console.log(`discard-no-extraction: session=${sessionId} commitments=${JSON.stringify(commitments)}`);
  if (JSON.stringify(commitments).includes("send the bank documents")) throw new Error("discarded session created daily commitment");
}

async function runVoiceSession(token: string, save: boolean, transcript: string): Promise<string> {
  const ws = new WebSocket(`${wsBase}/voice?token=${encodeURIComponent(token)}`);
  const events = collectEvents(ws);
  await open(ws);
  ws.send(
    JSON.stringify({
      type: "start",
      policy: "whisper_copilot",
      situationDescription: "I am talking with a bank about a loan.",
      consent: { granted: true, method: "user_tap", noticeText: "Live Assist is active.", participantCount: 2 },
      input: { kind: "text" },
      output: { kind: "text" },
      retentionPolicy: "ask_on_stop",
    }),
  );
  const ack = await waitFor(events, "voice_ack");
  ws.send(JSON.stringify({ type: "transcript", speaker: "speaker_1", text: transcript, offsetMs: 1000 }));
  await waitFor(events, "voice_segment");
  ws.send(JSON.stringify({ type: "stop", save }));
  await delay(500);
  ws.close();
  return String(ack.sessionId);
}

async function runVoiceQuestion(token: string, text: string) {
  const ws = new WebSocket(`${wsBase}/voice?token=${encodeURIComponent(token)}`);
  const events = collectEvents(ws);
  await open(ws);
  ws.send(
    JSON.stringify({
      type: "start",
      policy: "conversation_agent",
      situationDescription: "Daily planning.",
      consent: { granted: true, method: "user_tap", noticeText: "Live Assist is active.", participantCount: 1 },
      input: { kind: "text" },
      output: { kind: "text" },
      retentionPolicy: "ask_on_stop",
    }),
  );
  await waitFor(events, "voice_ack");
  ws.send(JSON.stringify({ type: "user_text", text }));
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
