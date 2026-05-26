import WebSocket from "ws";
import { config } from "../config.js";

type VoiceReplayName = "prep-bank" | "whisper-bank" | "prep-doctor" | "whisper-doctor";

interface VoiceReplayFixture {
  policy: "conversation_agent" | "whisper_copilot";
  description: string;
  title: string;
  outputKind: "text" | "tts" | "both";
  userText?: string;
  transcript?: { speaker: string; text: string; offsetMs: number };
}

const fixtures: Record<VoiceReplayName, VoiceReplayFixture> = {
  "prep-bank": {
    policy: "conversation_agent",
    description: "I am going to the bank to discuss a loan",
    title: "Bank loan preparation",
    outputKind: "text",
    userText: "What should I ask before this bank loan meeting?",
  },
  "whisper-bank": {
    policy: "whisper_copilot",
    description: "I am talking with a bank about a loan",
    title: "Bank loan live assist",
    outputKind: "both",
    transcript: {
      speaker: "speaker_1",
      text: "The APR is 9.4 percent and there is also an arrangement fee.",
      offsetMs: 1200,
    },
  },
  "prep-doctor": {
    policy: "conversation_agent",
    description: "I have a doctor appointment about blood test results",
    title: "Doctor preparation",
    outputKind: "text",
    userText: "What should I ask my doctor about blood test results?",
  },
  "whisper-doctor": {
    policy: "whisper_copilot",
    description: "I have a doctor appointment about blood test results",
    title: "Doctor live assist",
    outputKind: "both",
    transcript: {
      speaker: "speaker_1",
      text: "We should discuss your blood test result and medication side effects.",
      offsetMs: 1200,
    },
  },
};

interface DevUserResponse {
  user: { id: string; email: string };
  token: string;
}

async function main(): Promise<void> {
  const name = (process.argv[2] ?? "prep-bank") as VoiceReplayName;
  const fixture = fixtures[name];
  if (!fixture) throw new Error(`unknown voice replay "${name}"`);
  const save = process.argv.includes("--save");
  const base = `http://${config.HOST === "0.0.0.0" ? "127.0.0.1" : config.HOST}:${config.PORT}`;
  const events: Array<{ type: string; [key: string]: unknown }> = [];
  const criticalErrors: string[] = [];
  let sessionId: string | null = null;

  const dev = await postJson<DevUserResponse>(`${base}/dev/users`, {
    email: "voice-dev@example.com",
    displayName: "Voice Dev",
  });
  const situation = await postJson<{ situationBrief: { id: string; inferredType: string } }>(
    `${base}/situations`,
    { description: fixture.description },
    dev.token,
  );

  const ws = new WebSocket(`${base.replace(/^http/, "ws")}/voice?token=${encodeURIComponent(dev.token)}`);
  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });

  ws.on("message", (data) => {
    const event = JSON.parse(data.toString()) as { type: string; [key: string]: unknown };
    events.push(event);
    if (event.type === "voice_ack") sessionId = String(event.sessionId);
    if (event.type === "error" && !["provider"].includes(String(event.stage))) {
      criticalErrors.push(`${event.stage}: ${event.message}`);
    }
    if (
      [
        "voice_ack",
        "voice_state",
        "voice_segment",
        "voice_triggers",
        "voice_cue",
        "voice_assistant_text",
        "voice_speak_request",
        "voice_tts_unavailable",
        "summary",
        "error",
      ].includes(event.type)
    ) {
      console.log(`${event.type}: ${JSON.stringify(event)}`);
    }
  });

  ws.send(
    JSON.stringify({
      type: "start",
      policy: fixture.policy,
      situationBriefId: situation.situationBrief.id,
      title: fixture.title,
      consent: {
        granted: true,
        method: "user_tap",
        noticeText: "Live Assist is active. I confirm I have the right consent for this conversation.",
        participantCount: fixture.policy === "conversation_agent" ? 1 : 2,
        jurisdiction: "unknown",
      },
      input: { kind: "text" },
      output: { kind: fixture.outputKind },
      retentionPolicy: "ask_on_stop",
    }),
  );

  await waitFor(events, "voice_ack");
  if (fixture.userText) ws.send(JSON.stringify({ type: "user_text", text: fixture.userText }));
  if (fixture.transcript) ws.send(JSON.stringify({ type: "transcript", ...fixture.transcript }));

  if (fixture.policy === "conversation_agent") await waitFor(events, "voice_assistant_text");
  else {
    await waitFor(events, "voice_cue");
    await waitFor(events, "voice_speak_request");
    await waitFor(events, "voice_tts_unavailable");
  }

  ws.send(JSON.stringify({ type: "stop", save }));
  if (!sessionId) throw new Error("voice replay did not ack");
  const session = await waitForStoppedSession(`${base}/sessions/${sessionId}`, dev.token, save);
  console.log(`final_status: ${JSON.stringify(session)}`);
  ws.close();
  if (criticalErrors.length > 0) throw new Error(`critical voice errors: ${criticalErrors.join("; ")}`);
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

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

async function waitFor(events: Array<{ type: string }>, type: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (events.some((event) => event.type === type)) return;
    await delay(25);
  }
  throw new Error(`timed out waiting for ${type}; saw ${events.map((event) => event.type).join(", ")}`);
}

async function waitForStoppedSession(url: string, token: string, save: boolean, timeoutMs = 8000): Promise<{ status: string; counts?: Record<string, number> }> {
  const expectedStatus = save ? "saved" : "discarded";
  const deadline = Date.now() + timeoutMs;
  let last: { status: string; counts?: Record<string, number> } | null = null;
  while (Date.now() < deadline) {
    last = await fetchJson<{ status: string; counts?: Record<string, number> }>(url, token);
    const counts = last.counts ?? {};
    const discardedContentGone =
      save ||
      ["transcriptSegments", "suggestions", "cueEvents", "agentTurns", "voiceOutputs"].every((key) => Number(counts[key] ?? 0) === 0);
    if (last.status === expectedStatus && discardedContentGone) return last;
    await delay(100);
  }
  throw new Error(`timed out waiting for session ${expectedStatus}; last=${JSON.stringify(last)}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error(`voice:replay failed: ${(err as Error).message}`);
  process.exit(1);
});
