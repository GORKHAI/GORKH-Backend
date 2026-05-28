import WebSocket from "ws";
import { config } from "../config.js";
import { getFixture } from "./fixtures.js";

interface DevUserResponse {
  user: { id: string; email: string };
  token: string;
}

interface SessionDebugResponse {
  id: string;
  status: string;
  counts: {
    transcriptSegments: number;
    suggestions: number;
    cueEvents: number;
  };
}

async function main(): Promise<void> {
  const name = process.argv[2] ?? "bank";
  const save = process.argv.includes("--save");
  const fixture = getFixture(name);
  const base = `http://${config.HOST === "0.0.0.0" ? "127.0.0.1" : config.HOST}:${config.PORT}`;
  const events: Array<{ type: string; [key: string]: unknown }> = [];
  const criticalErrors: string[] = [];
  let sessionId: string | null = null;

  const userResponse = await fetch(`${base}/dev/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "dev@example.com", displayName: "Gorkh" }),
  });
  if (!userResponse.ok) throw new Error(`dev user failed: HTTP ${userResponse.status} ${await userResponse.text()}`);
  const dev = (await userResponse.json()) as DevUserResponse;

  const situationResponse = await fetch(`${base}/situations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${dev.token}` },
    body: JSON.stringify({
      description: fixture.description,
      userGoal: fixture.userGoal,
      participants: fixture.participants,
      scheduledAt: new Date().toISOString(),
    }),
  });
  if (!situationResponse.ok) throw new Error(`situation failed: HTTP ${situationResponse.status} ${await situationResponse.text()}`);
  const situation = (await situationResponse.json()) as { situationBrief: { id: string; inferredType: string } };

  const wsBase = base.replace(/^http/, "ws");
  const ws = new WebSocket(`${wsBase}/session?token=${encodeURIComponent(dev.token)}`);

  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });

  ws.on("message", (data) => {
    const event = JSON.parse(data.toString()) as { type: string; [key: string]: unknown };
    events.push(event);
    if (event.type === "ack") {
      sessionId = String(event.sessionId);
      console.log(`ack: ${JSON.stringify(event)}`);
    } else if (event.type === "segment") console.log(`segment: ${event.speaker}: ${event.text}`);
    else if (event.type === "triggers") console.log(`triggers: ${JSON.stringify(event.triggers)}`);
    else if (event.type === "cue") console.log(`cue: ${JSON.stringify(event.cue)}`);
    else if (event.type === "suggestion") console.log(`suggestion: ${JSON.stringify(event.card)}`);
    else if (event.type === "summary") console.log(`summary: ${JSON.stringify(event.storedMemoryIds)}`);
    else if (event.type === "error") {
      console.log(`error[${event.stage}]: ${event.message}`);
      if (!["suggestion", "extract"].includes(String(event.stage))) criticalErrors.push(`${event.stage}: ${event.message}`);
    }
    else console.log(`${event.type}: ${JSON.stringify(event)}`);
  });

  ws.send(
    JSON.stringify({
      type: "start",
      protocolVersion: 1,
      situationBriefId: situation.situationBrief.id,
      consent: {
        granted: true,
        method: "user_tap",
        noticeText: "Live Assist is active. I confirm I have the right consent for this conversation.",
        participantCount: fixture.participants.length + 1,
        jurisdiction: "unknown",
      },
      title: fixture.title,
      source: "text",
      retentionPolicy: "ask_on_stop",
      selfSpeakerIndex: 0,
    }),
  );

  await delay(250);
  for (const line of fixture.lines) {
    ws.send(JSON.stringify({ type: "transcript", ...line }));
    await delay(200);
  }
  await delay(500);
  ws.send(JSON.stringify({ type: "stop", save }));
  if (!sessionId) throw new Error("session did not ack");
  const session = await waitForStoppedSession(`${base}/sessions/${sessionId}`, dev.token, save);
  console.log(`stop: ${JSON.stringify({ save, session })}`);
  ws.close();
  if (criticalErrors.length > 0) throw new Error(`critical websocket errors: ${criticalErrors.join("; ")}`);
  if (!events.some((event) => event.type === "segment")) throw new Error("replay produced no segment events");
  if (!events.some((event) => event.type === "triggers")) throw new Error("replay produced no trigger events");
  if (!events.some((event) => event.type === "cue")) throw new Error("replay produced no deterministic cue events");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForStoppedSession(url: string, token: string, save: boolean, timeoutMs = 8000): Promise<SessionDebugResponse> {
  const expectedStatus = save ? "saved" : "discarded";
  const deadline = Date.now() + timeoutMs;
  let last: SessionDebugResponse | null = null;
  while (Date.now() < deadline) {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`session status failed: HTTP ${response.status} ${await response.text()}`);
    last = (await response.json()) as SessionDebugResponse;
    const discardedContentGone =
      save ||
      ["transcriptSegments", "suggestions", "cueEvents"].every((key) => Number(last?.counts[key as keyof SessionDebugResponse["counts"]] ?? 0) === 0);
    if (last.status === expectedStatus && discardedContentGone) return last;
    await delay(100);
  }
  throw new Error(`timed out waiting for session ${expectedStatus}; last=${JSON.stringify(last)}`);
}

main().catch((err) => {
  console.error(`replay: failed: ${(err as Error).message}`);
  process.exit(1);
});
