import { fetchJson, liveConfig, printSummary, requireUrl, runCheck } from "./live-verify-utils.js";

const cfg = liveConfig();
const apiUrl = requireUrl(cfg.apiUrl, "LIVE_API_URL");
const gatewayUrl = requireUrl(cfg.gatewayUrl, "LIVE_GATEWAY_URL");

const checks = [
  await runCheck("production dev pages disabled", async () => {
    const live = await status(`${gatewayUrl}/dev/live`);
    const brain = await status(`${gatewayUrl}/dev/brain`);
    if (![404, 403].includes(live) || ![404, 403].includes(brain)) throw new Error(`unexpected dev page status live=${live} brain=${brain}`);
    return { live, brain };
  }),
  await runCheck("ops pages require protection", async () => {
    const live = await status(`${gatewayUrl}/ops/live`);
    const brain = await status(`${gatewayUrl}/ops/brain`);
    if (![401, 404].includes(live) || ![401, 404].includes(brain)) throw new Error(`unexpected ops page status live=${live} brain=${brain}`);
    return { live, brain };
  }),
  await runCheck("dev user endpoint not exposed", async () => {
    const code = await status(`${apiUrl}/dev/users`, { method: "POST", body: JSON.stringify({ email: "render-smoke@gorkh.dev", displayName: "Render Smoke" }) });
    if (![404, 403, 405].includes(code)) throw new Error(`/dev/users exposed with status ${code}`);
    return { status: code };
  }),
  await runCheck("ops test user endpoint protected", async () => {
    const code = await status(`${apiUrl}/ops/test-user`, { method: "POST", body: JSON.stringify({ email: "render-smoke@gorkh.dev", displayName: "Render Smoke" }) });
    if (![401, 404].includes(code)) throw new Error(`/ops/test-user unexpectedly available without token: ${code}`);
    return { status: code };
  }),
  await runCheck("public health remains reachable", async () => {
    const health = await fetchJson<Record<string, unknown>>(`${apiUrl}/health`);
    const gateway = await fetchJson<Record<string, unknown>>(`${gatewayUrl}/health`);
    return { apiOk: health.ok, gatewayOk: gateway.ok };
  }),
];

printSummary("live:verify:prod-safety", checks);

async function status(url: string, init: RequestInit = {}): Promise<number> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(cfg.timeoutMs),
  });
  await response.arrayBuffer();
  return response.status;
}
