import WebSocket from "ws";
import { gatewayConfig } from "../config.js";

type ReplayName = "text-prep-bank" | "text-whisper-bank" | "text-prep-doctor" | "text-whisper-doctor" | "pcm-missing-asr";

interface ReplayFixture {
  policy: "conversation_agent" | "whisper_copilot";
  description: string;
  title: string;
  inputKind: "text" | "pcm16";
  userText?: string;
  transcript?: { speaker: string; text: string; offsetMs: number };
  expectProviderError?: boolean;
}

const fixtures: Record<ReplayName, ReplayFixture> = {
  "text-prep-bank": {
    policy: "conversation_agent",
    description: "I am going to the bank to discuss a loan",
    title: "Gateway bank preparation",
    inputKind: "text",
    userText: "What should I ask before this bank loan meeting?",
  },
  "text-whisper-bank": {
    policy: "whisper_copilot",
    description: "I am talking with a bank about a loan",
    title: "Gateway bank live assist",
    inputKind: "text",
    transcript: { speaker: "speaker_1", text: "The APR is 9.4 percent and there is also an arrangement fee.", offsetMs: 1200 },
  },
  "text-prep-doctor": {
    policy: "conversation_agent",
    description: "I have a doctor appointment about blood test results",
    title: "Gateway doctor preparation",
    inputKind: "text",
    userText: "What should I ask my doctor about blood test results?",
  },
  "text-whisper-doctor": {
    policy: "whisper_copilot",
    description: "I have a doctor appointment about blood test results",
    title: "Gateway doctor live assist",
    inputKind: "text",
    transcript: { speaker: "speaker_1", text: "We should discuss your blood test result and medication side effects.", offsetMs: 1200 },
  },
  "pcm-missing-asr": {
    policy: "whisper_copilot",
    description: "I am talking with a bank about a loan",
    title: "Gateway missing ASR",
    inputKind: "pcm16",
    expectProviderError: true,
  },
};

interface DevUserResponse {
  user: { id: string; email: string };
  token: string;
}

async function main(): Promise<void> {
  const name = (process.argv[2] ?? "text-prep-bank") as ReplayName;
  const fixture = fixtures[name];
  if (!fixture) throw new Error(`unknown gateway replay "${name}"`);
  const backendHttp = gatewayConfig.GORKH_BACKEND_HTTP_URL.replace(/\/$/, "");
  if (fixture.expectProviderError) {
    const providers = await fetchJson<{ asr?: { available?: boolean; selected?: string } }>(
      `http://${gatewayConfig.VOICE_GATEWAY_HOST === "0.0.0.0" ? "127.0.0.1" : gatewayConfig.VOICE_GATEWAY_HOST}:${gatewayConfig.VOICE_GATEWAY_PORT}/providers`,
    );
    if (providers.asr?.available) {
      console.log(`pcm-missing-asr: ASR provider ${providers.asr.selected} is configured; missing-provider scenario skipped`);
      return;
    }
  }
  const gatewayWs = `ws://${gatewayConfig.VOICE_GATEWAY_HOST === "0.0.0.0" ? "127.0.0.1" : gatewayConfig.VOICE_GATEWAY_HOST}:${gatewayConfig.VOICE_GATEWAY_PORT}`;
  const events: Array<{ type: string; [key: string]: unknown }> = [];
  let backendSessionId: string | null = null;

  const dev = await postJson<DevUserResponse>(`${backendHttp}/dev/users`, {
    email: "gateway-dev@example.com",
    displayName: "Gateway Dev",
  });
  const situation = await postJson<{ situationBrief: { id: string } }>(`${backendHttp}/situations`, { description: fixture.description }, dev.token);

  const ws = new WebSocket(`${gatewayWs}/gateway/voice?token=${encodeURIComponent(dev.token)}`);
  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });

  ws.on("message", (data) => {
    const event = JSON.parse(data.toString()) as { type: string; [key: string]: unknown };
    events.push(event);
    if (event.type === "gateway_ack") backendSessionId = String(event.backendSessionId);
    if (event.type === "voice_ack") backendSessionId = String(event.sessionId);
    if (interesting(event.type)) console.log(`${event.type}: ${JSON.stringify(event)}`);
  });

  ws.send(
    JSON.stringify({
      type: "start",
      protocolVersion: 1,
      policy: fixture.policy,
      situationBriefId: situation.situationBrief.id,
      situationDescription: fixture.description,
      title: fixture.title,
      consent: {
        granted: true,
        method: "user_tap",
        noticeText: "Live Assist is active. I confirm I have the right consent for this conversation.",
        participantCount: fixture.policy === "conversation_agent" ? 1 : 2,
        jurisdiction: "unknown",
      },
      input: fixture.inputKind === "pcm16" ? { kind: "pcm16", sampleRate: 16000, channels: 1 } : { kind: "text" },
      output: { kind: "both" },
      retentionPolicy: "ask_on_stop",
    }),
  );

  if (fixture.expectProviderError) {
    await waitFor(events, "gateway_provider_error");
    ws.close();
    if (events.some((event) => event.type === "voice_ack" || event.type === "gateway_asr_final")) throw new Error("pcm missing ASR replay activated backend or fabricated transcript");
    return;
  }

  await waitFor(events, "gateway_ack");
  if (fixture.userText) ws.send(JSON.stringify({ type: "user_text", text: fixture.userText }));
  if (fixture.transcript) ws.send(JSON.stringify({ type: "transcript", ...fixture.transcript }));

  if (fixture.policy === "conversation_agent") await waitFor(events, "voice_assistant_text");
  else await waitFor(events, "voice_cue");
  await waitFor(events, "voice_speak_request");
  await waitFor(events, "gateway_client_tts_instruction");
  ws.send(JSON.stringify({ type: "stop", save: false }));
  if (!backendSessionId) throw new Error("gateway replay did not receive backend session id");
  const finalStatus = await waitForStoppedSession(`${backendHttp}/sessions/${backendSessionId}`, dev.token);
  console.log(`final_status: ${JSON.stringify(finalStatus)}`);
  ws.close();
}

function interesting(type: string): boolean {
  return [
    "gateway_ack",
    "gateway_state",
    "gateway_provider_error",
    "gateway_client_tts_instruction",
    "gateway_metrics",
    "voice_ack",
    "voice_state",
    "voice_segment",
    "voice_triggers",
    "voice_cue",
    "voice_assistant_text",
    "voice_speak_request",
    "voice_tts_unavailable",
    "voice_cancel_speech",
    "summary",
    "error",
    "gateway_error",
  ].includes(type);
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

async function fetchJson<T>(url: string, token?: string): Promise<T> {
  const response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForStoppedSession(
  url: string,
  token: string,
  timeoutMs = 8000,
): Promise<{
  status: string;
  counts?: { transcriptSegments?: number; suggestions?: number; cueEvents?: number; agentTurns?: number; voiceOutputs?: number };
}> {
  const deadline = Date.now() + timeoutMs;
  let last: {
    status: string;
    counts?: { transcriptSegments?: number; suggestions?: number; cueEvents?: number; agentTurns?: number; voiceOutputs?: number };
  } | null = null;
  while (Date.now() < deadline) {
    last = await fetchJson<{
      status: string;
      counts?: { transcriptSegments?: number; suggestions?: number; cueEvents?: number; agentTurns?: number; voiceOutputs?: number };
    }>(url, token);
    const counts = last.counts ?? {};
    const contentGone = ["transcriptSegments", "suggestions", "cueEvents", "agentTurns", "voiceOutputs"].every((key) => Number(counts[key as keyof typeof counts] ?? 0) === 0);
    if (last.status === "discarded" && contentGone) return last;
    await delay(100);
  }
  throw new Error(`timed out waiting for backend session discard; last=${JSON.stringify(last)}`);
}

main().catch((err) => {
  console.error(`gateway:replay failed: ${(err as Error).message}`);
  process.exit(1);
});
