import { config } from "../config.js";

type ReplayName = "bank-apr" | "doctor-test-results" | "company-brief";

const scenarios: Record<ReplayName, string> = {
  "bank-apr": "official APR explanation consumer loan",
  "doctor-test-results": "find official source for patient explanation blood test results",
  "company-brief": "find official source for company background before business meeting",
};

interface DevUserResponse {
  token: string;
  user: { id: string; email: string };
}

async function main(): Promise<void> {
  const name = (process.argv[2] ?? "bank-apr") as ReplayName;
  if (!scenarios[name]) throw new Error(`unknown research replay "${name}"`);
  const base = `http://${config.HOST === "0.0.0.0" ? "127.0.0.1" : config.HOST}:${config.PORT}`;
  const dev = await postJson<DevUserResponse>(`${base}/dev/users`, { email: `research-${name}@example.com`, displayName: "Research Replay" });
  const providers = await getJson<{ selected: string; configured: boolean }>(`${base}/research/providers`, dev.token);
  console.log(`research:replay:${name}: provider=${providers.selected} configured=${providers.configured}`);
  const result = await postJson<{ error?: { code: string }; sources?: Array<{ url: string; title?: string }>; answer?: { citations?: unknown[] } }>(
    `${base}/research/query`,
    { text: scenarios[name] },
    dev.token,
  );
  if (!providers.configured) {
    if (result.error?.code !== "provider_not_configured") throw new Error("expected provider_not_configured with missing research provider");
    if ((result.sources ?? []).length !== 0) throw new Error("missing provider returned fake sources");
    console.log(`research:replay:${name}: provider_not_configured; no fake results or citations generated.`);
    return;
  }
  if (!result.sources || result.sources.length === 0) throw new Error("configured provider returned no source-backed results");
  for (const source of result.sources) {
    console.log(`research:replay:${name}: source domain=${domainOf(source.url)} title="${(source.title ?? "").slice(0, 100)}"`);
  }
  if (result.answer && (!result.answer.citations || result.answer.citations.length === 0)) {
    throw new Error("research answer did not include source-backed citations");
  }
}

async function postJson<T = unknown>(url: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${url} failed: HTTP ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

async function getJson<T = unknown>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`GET ${url} failed: HTTP ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "invalid-url";
  }
}

main().catch((err) => {
  console.error(`research:replay: failed: ${(err as Error).message}`);
  process.exit(1);
});
