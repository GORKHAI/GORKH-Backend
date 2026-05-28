import { assert, collectWsEvents, expectWsAuthRejection, fetchJson, getLiveToken, liveConfig, printSummary, requireUrl, runCheck } from "./live-verify-utils.js";

const cfg = liveConfig();
const apiUrl = requireUrl(cfg.apiUrl, "LIVE_API_URL");
const gatewayUrl = requireUrl(cfg.gatewayUrl, "LIVE_GATEWAY_URL");
const gatewayWsUrl = requireUrl(cfg.gatewayWsUrl, "LIVE_GATEWAY_WS_URL");
const token = await getLiveToken(apiUrl, cfg);

const checks = [
  await runCheck("gateway health", async () => {
    const health = await fetchJson<Record<string, unknown>>(`${gatewayUrl}/health`);
    assert(typeof health.backend === "boolean", "backend health field missing");
    return health;
  }),
  await runCheck("gateway providers", async () => fetchJson(`${gatewayUrl}/providers`)),
  await runCheck("dev pages policy", async () => {
    const brain = await fetch(`${gatewayUrl}/dev/brain`, { signal: AbortSignal.timeout(cfg.timeoutMs) });
    const live = await fetch(`${gatewayUrl}/dev/live`, { signal: AbortSignal.timeout(cfg.timeoutMs) });
    return { brainStatus: brain.status, liveStatus: live.status };
  }),
  await runCheck("gateway websocket auth rejection", async () => expectWsAuthRejection(`${gatewayWsUrl}/gateway/voice`)),
  await runCheck("gateway text voice loop", async () => {
    const events = await collectWsEvents({
      url: `${gatewayWsUrl}/gateway/voice`,
      token,
      expectTypes: ["gateway_ack", "voice_assistant_text", "voice_speak_request", "gateway_client_tts_instruction"],
      messages: [
        {
          type: "start",
          protocolVersion: 1,
          policy: "conversation_agent",
          situationDescription: "I am going to the bank to discuss a loan",
          title: "Render smoke bank prep",
          consent: { granted: true, method: "user_tap", noticeText: "Live Assist is active.", participantCount: 1, jurisdiction: "unknown" },
          input: { kind: "text" },
          output: { kind: "both" },
          retentionPolicy: "ask_on_stop",
        },
        { type: "user_text", text: "What should I ask before this bank loan meeting?" },
      ],
      afterExpectedMessages: [{ type: "stop", save: false }],
    });
    return { eventTypes: events.map((event) => event.type) };
  }),
];

printSummary("live:verify:gateway", checks);
