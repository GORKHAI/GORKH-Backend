import { fetchJson, liveConfig, printSummary, runCheck } from "./live-verify-utils.js";

const cfg = liveConfig();
const checks = [
  await runCheck("ops console smoke", async () => {
    if (!cfg.gatewayUrl || !cfg.apiUrl) return { skipped: true, reason: "LIVE_API_URL/LIVE_GATEWAY_URL not configured" };
    const [opsLive, opsBrain, devLive, devBrain] = await Promise.all([
      status(`${cfg.gatewayUrl}/ops/live`),
      status(`${cfg.gatewayUrl}/ops/brain`),
      status(`${cfg.gatewayUrl}/dev/live`),
      status(`${cfg.gatewayUrl}/dev/brain`),
    ]);
    const gateway = await fetchJson<Record<string, unknown>>(`${cfg.gatewayUrl}/providers`);
    return { opsLive, opsBrain, devLive, devBrain, gateway };
  }),
];

printSummary("ops:console:smoke", checks);

async function status(url: string): Promise<number> {
  const response = await fetch(url, { signal: AbortSignal.timeout(cfg.timeoutMs) });
  await response.arrayBuffer();
  return response.status;
}
