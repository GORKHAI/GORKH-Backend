import { config } from "../config.js";
import { researchProviderStatus } from "../research/provider.js";
import { runResearchSubagent } from "../subagents/workers/research-subagent.js";
import type { SubagentTask } from "../subagents/types.js";

type ScenarioName = "bank-apr" | "doctor-test-results" | "company-brief";

const scenarios: Record<ScenarioName, { query: string; intent: string }> = {
  "bank-apr": { query: "official APR explanation consumer loan", intent: "bank_loan" },
  "doctor-test-results": { query: "find official source for patient explanation blood test results", intent: "doctor_visit" },
  "company-brief": { query: "find official source for company background before business meeting", intent: "business_meeting" },
};

const name = normalizeScenario(process.argv[2], process.argv[3]);
const status = researchProviderStatus();
console.log(`subagents:live-research:verify:${name}: provider=${status.selected} configured=${status.configured}`);

if (!status.configured) {
  if (config.RESEARCH_LIVE_REQUIRED) {
    console.error("subagents:live-research:verify: provider_not_configured and RESEARCH_LIVE_REQUIRED=true");
    process.exit(1);
  }
  console.log("subagents:live-research:verify: provider_not_configured; no fake citations generated.");
  process.exit(0);
}

const controller = new AbortController();
const report = await runResearchSubagent(task(name), {
  signal: controller.signal,
  emitProgress: async (message) => console.log(`subagents:live-research:verify:${name}: ${message}`),
});
if (report.status !== "completed") throw new Error(`research subagent did not complete: ${report.summary}`);
const citations = report.findings.flatMap((finding) => finding.citations ?? []);
if (citations.length === 0) throw new Error("configured provider subagent report did not include citations");
for (const citation of citations) {
  if (!citation.url || !/^https?:\/\//i.test(citation.url)) throw new Error("subagent report included invalid citation URL");
}
console.log(`subagents:live-research:verify:${name}: source-backed subagent report validated with ${citations.length} citation(s).`);

function task(name: ScenarioName): SubagentTask {
  const scenario = scenarios[name];
  return {
    id: "00000000-0000-0000-0000-000000000101",
    userId: "00000000-0000-0000-0000-000000000102",
    kind: "research",
    trigger: "user_request",
    priority: "normal",
    input: { query: scenario.query, intent: scenario.intent, internalType: scenario.intent },
    policy: {
      allowResearch: true,
      allowProfileContext: false,
      allowMemory: false,
      allowStressSupport: false,
      allowUserFacingReport: true,
      liveDelivery: "screen_only",
    },
    timeoutMs: config.SUBAGENT_RESEARCH_TIMEOUT_MS,
    createdAt: new Date().toISOString(),
  };
}

function normalizeScenario(first?: string, second?: string): ScenarioName {
  const raw = first && first !== "--" ? first : second;
  if (!raw) return "bank-apr";
  if (raw in scenarios) return raw as ScenarioName;
  throw new Error(`unknown subagent live research scenario "${raw}"`);
}
