import { assert, fetchJson, getLiveToken, liveConfig, printSummary, requireUrl, runCheck } from "./live-verify-utils.js";

const cfg = liveConfig();
const apiUrl = requireUrl(cfg.apiUrl, "LIVE_API_URL");
const token = await getLiveToken(apiUrl, cfg);

const checks = [
  await runCheck("api health", async () => {
    const health = await fetchJson<Record<string, unknown>>(`${apiUrl}/health`);
    assert(health.ok === true, "health ok was not true");
    assert(health.db === true, "db was not true");
    assert(health.redis === true, "redis was not true");
    assert(typeof health.providers === "object", "providers shape missing");
    return { ok: health.ok, providers: health.providers };
  }),
  await runCheck("api readiness", async () => {
    const ready = await fetchJson<Record<string, unknown>>(`${apiUrl}/health/ready`);
    assert(ready.ok === true, "ready ok was not true");
    return ready;
  }),
  await runCheck("authenticated control surfaces", async () => {
    const dashboard = await fetchJson(`${apiUrl}/brain/dashboard`, { token });
    const profile = await fetchJson(`${apiUrl}/human/profile/review`, { token });
    const stress = await fetchJson(`${apiUrl}/stress/settings`, { token });
    const tools = await fetchJson(`${apiUrl}/tools/permissions`, { token });
    const connectors = await fetchJson(`${apiUrl}/connectors`, { token });
    const actions = await fetchJson(`${apiUrl}/actions/proposals`, { token });
    const queue = await fetchJson(`${apiUrl}/subagents/queue/metrics`, { token });
    return { dashboard, profile, stress, tools, connectors, actions, queue };
  }),
];

printSummary("live:verify:api", checks);
