import { gatewayConfig } from "../config.js";

async function main(): Promise<void> {
  const backend = await getJson(`${gatewayConfig.GORKH_BACKEND_HTTP_URL.replace(/\/$/, "")}/health`);
  const gateway = await getJson(`http://127.0.0.1:${gatewayConfig.VOICE_GATEWAY_PORT}/health`);
  const providers = await getJson(`http://127.0.0.1:${gatewayConfig.VOICE_GATEWAY_PORT}/providers`);
  console.log(`live: backend health ${JSON.stringify(backend)}`);
  console.log(`live: gateway health ${JSON.stringify(gateway)}`);
  console.log(`live: providers ${JSON.stringify(providers)}`);
  console.log(gatewayConfig.DEEPGRAM_API_KEY ? "live: Deepgram configured" : "live: live ASR not configured; browser typed-mode still available");
  const llm = (backend as { providers?: { llm?: { selected?: string; configured?: boolean } } }).providers?.llm;
  console.log(llm?.configured ? `live: LLM configured (${llm.selected})` : "live: LLM not configured; deterministic paths still available");
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error(`${url} failed HTTP ${response.status}`);
  return response.json();
}

main().catch((err) => {
  console.error(`gateway:live:check failed: ${(err as Error).message}`);
  process.exit(1);
});
