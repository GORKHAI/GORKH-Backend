import WebSocket from "ws";
import { assert, delay, getLiveToken, liveConfig, printSummary, requireUrl, runCheck, waitFor } from "./live-verify-utils.js";

const cfg = liveConfig();
const apiUrl = requireUrl(cfg.apiUrl, "LIVE_API_URL");
const apiWsUrl = requireUrl(cfg.apiWsUrl, "LIVE_API_WS_URL");
const token = await getLiveToken(apiUrl, cfg);

const checks = [
  await runCheck("discard clears retained voice/session data", async () => {
    const events: Array<Record<string, unknown>> = [];
    const ws = new WebSocket(`${apiWsUrl}/voice?token=${encodeURIComponent(token)}`);
    ws.on("message", (data) => events.push(JSON.parse(data.toString()) as Record<string, unknown>));
    await new Promise<void>((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });
    ws.send(
      JSON.stringify({
        type: "start",
        policy: "whisper_copilot",
        situationDescription: "I am talking with a bank about a loan",
        title: "Privacy smoke",
        consent: { granted: true, method: "user_tap", noticeText: "Live Assist is active.", participantCount: 2, jurisdiction: "unknown" },
        input: { kind: "text" },
        output: { kind: "text" },
        retentionPolicy: "ask_on_stop",
      }),
    );
    await waitFor(async () => (events.some((event) => event.type === "voice_ack") ? events : null), cfg.timeoutMs, 100);
    ws.send(JSON.stringify({ type: "transcript", speaker: "speaker_1", text: "The APR is 9.4 percent and there is also an arrangement fee.", offsetMs: 1000 }));
    await waitFor(async () => (events.some((event) => event.type === "voice_cue") ? events : null), cfg.timeoutMs, 100);
    const ack = events.find((event) => event.type === "voice_ack") as { sessionId?: string } | undefined;
    if (!ack?.sessionId) throw new Error("session id missing");
    const sessionId = ack.sessionId;
    ws.send(JSON.stringify({ type: "stop", save: false }));
    const session = await waitFor(async () => {
      const current = await getSessionOrNull(sessionId);
      if (!current || current.status === "discarded") return current ?? { status: "not_found_after_discard", counts: { transcriptSegments: 0, suggestions: 0, cueEvents: 0, agentTurns: 0, voiceOutputs: 0 } };
      return null;
    }, cfg.timeoutMs, 250);
    await delay(100);
    ws.close();
    const counts = session?.counts ?? { transcriptSegments: 0, suggestions: 0, cueEvents: 0, agentTurns: 0, voiceOutputs: 0 };
    assert(!session || session.status === "discarded" || session.status === "not_found_after_discard", "session was not discarded or suppressed");
    assert(Object.values(counts).every((count) => count === 0), "discarded session retained content counts");
    return { sessionId, status: session?.status ?? "not_found_after_discard", counts };
  }),
];

printSummary("live:verify:privacy", checks);

async function getSessionOrNull(sessionId: string): Promise<{ status: string; counts: Record<string, number> } | null> {
  const response = await fetch(`${apiUrl}/sessions/${sessionId}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(cfg.timeoutMs) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`session lookup failed: ${response.status} ${await response.text()}`);
  return (await response.json()) as { status: string; counts: Record<string, number> };
}
