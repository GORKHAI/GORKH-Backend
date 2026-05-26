import { config } from "../config.js";
import { processDueSubagentTasksOnce } from "../subagents/worker.js";

type ScenarioName = "bank-apr" | "doctor-test-results" | "company-brief";

const scenarios: Record<ScenarioName, { query: string; intent: string }> = {
  "bank-apr": { query: "official APR explanation consumer loan", intent: "bank_loan" },
  "doctor-test-results": { query: "find official source for patient explanation blood test results", intent: "doctor_visit" },
  "company-brief": { query: "find official source for company background before business meeting", intent: "business_meeting" },
};

const name = (process.argv[2] ?? "bank-apr") as ScenarioName;
if (!scenarios[name]) throw new Error(`unknown subagent live research scenario "${name}"`);

const base = `http://${config.HOST === "0.0.0.0" ? "127.0.0.1" : config.HOST}:${config.PORT}`;
const dev = await postJson<{ token: string; user: { id: string } }>(`${base}/dev/users`, { email: `subagents-live-${name}@example.com`, displayName: "Subagent Live Research" });
const providers = await getJson<{ selected: string; configured: boolean }>(`${base}/research/providers`, dev.token);
console.log(`subagents:live-research:${name}: provider=${providers.selected} configured=${providers.configured}`);
const task = await postJson<{ task: { id: string } }>(
  `${base}/subagents/tasks`,
  {
    kind: "research",
    trigger: "user_request",
    priority: "normal",
    input: { query: scenarios[name].query, intent: scenarios[name].intent, internalType: scenarios[name].intent },
    policy: { allowResearch: true, allowProfileContext: false, allowMemory: false, allowStressSupport: false, allowUserFacingReport: true, liveDelivery: "screen_only" },
  },
  dev.token,
);
await processDueSubagentTasksOnce();
const report = await waitForReport(base, dev.token, task.task.id);
const notifications = await getJson<{ notifications: unknown[] }>(`${base}/subagents/notifications?taskId=${task.task.id}`, dev.token);
const text = JSON.stringify(report);
if (!providers.configured) {
  if (!text.includes("provider_not_configured")) throw new Error("expected provider_not_configured report");
  if (/"citations":\s*\[.+\]/.test(text)) throw new Error("missing provider produced fake citations");
  console.log(`subagents:live-research:${name}: provider_not_configured; no fake citations.`);
} else {
  if (!/"citations":\s*\[.+\]/.test(text)) throw new Error("configured provider report did not include source-backed citations");
  console.log(`subagents:live-research:${name}: source-backed report stored.`);
}
if (notifications.notifications.length === 0) throw new Error("expected notification for live research task");
console.log(`subagents:live-research:${name}: task=${task.task.id} notifications=${notifications.notifications.length}`);

async function postJson<T>(url: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`POST ${url} failed: HTTP ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

async function getJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

async function waitForReport(baseUrl: string, token: string, taskId: string): Promise<unknown> {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const task = await getJson<{ task: { status: string } }>(`${baseUrl}/subagents/tasks/${taskId}`, token);
    if (["completed", "failed", "suppressed", "expired", "canceled"].includes(task.task.status)) {
      return getJson(`${baseUrl}/subagents/tasks/${taskId}/report`, token);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("timed out waiting for subagent live research report");
}
