import { config } from "../config.js";
import { checkDb } from "../db/client.js";
import { checkRedis } from "../redis.js";
import { currentWorkerId } from "../subagents/queue.js";
import { subagentQueueMetrics } from "../subagents/metrics.js";

const apiUrl = process.env.GORKH_API_HTTP_URL ?? `http://${config.HOST === "0.0.0.0" ? "127.0.0.1" : config.HOST}:${config.PORT}`;
const gatewayUrl = process.env.GORKH_GATEWAY_HTTP_URL ?? (process.env.VOICE_GATEWAY_PORT ? `http://127.0.0.1:${process.env.VOICE_GATEWAY_PORT}` : null);
const apiHealth = await fetchJson(`${apiUrl}/health`).catch((err) => ({ ok: false, error: (err as Error).message }));
const gatewayHealth = gatewayUrl ? await fetchJson(`${gatewayUrl}/health`).catch((err) => ({ ok: false, error: (err as Error).message })) : { skipped: true };
const metrics = await subagentQueueMetrics(currentWorkerId());
console.log(JSON.stringify({ db: await checkDb(), redis: await checkRedis(), api: apiHealth, gateway: gatewayHealth, worker: { runnerMode: metrics.runnerMode, queueCounts: metrics.queueCounts } }, null, 2));

async function fetchJson(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, ...body };
}
