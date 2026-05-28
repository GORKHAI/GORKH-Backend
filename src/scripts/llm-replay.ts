import WebSocket from "ws";
import { config } from "../config.js";
import { selectedLlmStatus } from "../llm/provider.js";

type ReplayName = "open-ended-bank" | "suggestion-bank";

interface DevUserResponse {
  user: { id: string; email: string };
  token: string;
}

async function main(): Promise<void> {
  const name = (process.argv[2] ?? "open-ended-bank") as ReplayName;
  if (!["open-ended-bank", "suggestion-bank"].includes(name)) throw new Error(`unknown llm replay "${name}"`);
  const status = selectedLlmStatus();
  const base = `http://${config.HOST === "0.0.0.0" ? "127.0.0.1" : config.HOST}:${config.PORT}`;
  const events: Array<{ type: string; [key: string]: unknown }> = [];

  const dev = await postJson<DevUserResponse>(`${base}/dev/users`, {
    email: "llm-dev@example.com",
    displayName: "LLM Dev",
  });
  const situation = await postJson<{ situationBrief: { id: string } }>(
    `${base}/situations`,
    { description: "I am going to the bank to discuss a mortgage loan" },
    dev.token,
  );
  const wsPath = name === "suggestion-bank" ? "session" : "voice";
  const ws = new WebSocket(`${base.replace(/^http/, "ws")}/${wsPath}?token=${encodeURIComponent(dev.token)}`);
  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  ws.on("message", (data) => {
    const event = JSON.parse(data.toString()) as { type: string; [key: string]: unknown };
    events.push(event);
    if (["ack", "cue", "voice_ack", "voice_cue", "voice_assistant_text", "voice_speak_request", "suggestion", "error"].includes(event.type)) {
      console.log(`${event.type}: ${JSON.stringify(event)}`);
    }
  });

  ws.send(
    JSON.stringify({
      type: "start",
      protocolVersion: 1,
      ...(name === "open-ended-bank" ? { policy: "conversation_agent" } : {}),
      situationBriefId: situation.situationBrief.id,
      title: `LLM replay ${name}`,
      consent: {
        granted: true,
        method: "user_tap",
        noticeText: "Live Assist is active. I confirm I have the right consent for this conversation.",
        participantCount: name === "open-ended-bank" ? 1 : 2,
        jurisdiction: "unknown",
      },
      ...(name === "open-ended-bank" ? { input: { kind: "text" }, output: { kind: "both" } } : { source: "text" }),
      retentionPolicy: "ask_on_stop",
    }),
  );
  await waitFor(events, name === "open-ended-bank" ? "voice_ack" : "ack");

  if (name === "open-ended-bank") {
    ws.send(JSON.stringify({ type: "user_text", text: "Explain the difference between APR and nominal interest rate in simple terms." }));
    const result = await waitForAny(events, ["voice_assistant_text", "error"], 15000);
    if (result === "error") await assertProviderError(events);
    else if (!status.configured) throw new Error("LLM response arrived even though selected provider is not configured in this process");
  } else {
    ws.send(
      JSON.stringify({
        type: "transcript",
        speaker: "speaker_1",
        text: "The APR is 9.4 percent and there is also an arrangement fee, and you can sign today.",
        offsetMs: 1200,
      }),
    );
    await waitFor(events, "cue");
    if (status.configured) {
      const result = await waitForAny(events, ["suggestion", "error"], 15000);
      if (result === "error") {
        await assertProviderError(events);
        ws.send(JSON.stringify({ type: "stop", save: false }));
        await delay(500);
        ws.close();
        return;
      }
      const suggestion = events.find((event) => event.type === "suggestion")?.card;
      if (!suggestion || typeof suggestion !== "object") throw new Error("missing LLM suggestion card");
      const spokenCue = String((suggestion as { spokenCue?: unknown }).spokenCue ?? "");
      if (spokenCue.split(/\s+/).filter(Boolean).length > config.VOICE_MAX_SPOKEN_WORDS) throw new Error("suggestion spokenCue exceeded word limit");
    } else {
      await waitForProviderError(events);
    }
  }

  ws.send(JSON.stringify({ type: "stop", save: false }));
  await delay(500);
  ws.close();
}

async function waitForProviderError(events: Array<{ type: string; [key: string]: unknown }>): Promise<void> {
  await waitFor(events, "error", 8000);
  await assertProviderError(events);
}

async function assertProviderError(events: Array<{ type: string; [key: string]: unknown }>): Promise<void> {
  const providerError = events.find((event) => event.type === "error" && ["provider", "suggestion"].includes(String(event.stage)));
  if (!providerError) throw new Error("expected provider_not_configured error");
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

async function waitFor(events: Array<{ type: string }>, type: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (events.some((event) => event.type === type)) return;
    await delay(25);
  }
  throw new Error(`timed out waiting for ${type}; saw ${events.map((event) => event.type).join(", ")}`);
}

async function waitForAny(events: Array<{ type: string }>, types: string[], timeoutMs = 5000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = events.find((event) => types.includes(event.type));
    if (found) return found.type;
    await delay(25);
  }
  throw new Error(`timed out waiting for ${types.join(" or ")}; saw ${events.map((event) => event.type).join(", ")}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error(`llm:replay failed: ${(err as Error).message}`);
  process.exit(1);
});
