import { assert, fetchJson, getLiveToken, liveConfig, printSummary, requireUrl, runCheck, waitFor } from "./live-verify-utils.js";

const cfg = liveConfig();
const apiUrl = requireUrl(cfg.apiUrl, "LIVE_API_URL");
const token = await getLiveToken(apiUrl, cfg);

const checks = [
  await runCheck("queue metrics reachable", async () => fetchJson(`${apiUrl}/subagents/queue/metrics`, { token })),
  await runCheck("worker processes durable task", async () => {
    const created = await fetchJson<{ task: { id: string } }>(`${apiUrl}/subagents/tasks`, {
      token,
      body: {
        kind: "research",
        trigger: "user_request",
        priority: "normal",
        input: { query: "official APR explanation consumer loan", intent: "bank_loan" },
        policy: { allowResearch: true, allowProfileContext: false, allowMemory: false, allowStressSupport: false, allowUserFacingReport: true, liveDelivery: "screen_only" },
      },
    });
    const taskId = created.task.id;
    const report = await waitFor(async () => {
      const response = await fetch(`${apiUrl}/subagents/tasks/${taskId}/report`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`report failed: ${response.status} ${await response.text()}`);
      return (await response.json()) as Record<string, unknown>;
    }, cfg.timeoutMs);
    const notifications = await fetchJson(`${apiUrl}/subagents/notifications?taskId=${encodeURIComponent(taskId)}`, { token });
    const text = JSON.stringify(report);
    assert(text.includes("provider_not_configured") || text.includes("citations") || text.includes("findings"), "report did not contain provider status or findings");
    return { taskId, report, notifications };
  }),
];

printSummary("live:verify:worker", checks);
