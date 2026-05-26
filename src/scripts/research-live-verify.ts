import { config } from "../config.js";
import { createSearchProvider, researchProviderStatus } from "../research/provider.js";

type ScenarioName = "bank-apr" | "doctor-test-results" | "company-brief";

const scenarios: Record<ScenarioName, string> = {
  "bank-apr": "official APR explanation consumer loan",
  "doctor-test-results": "find official source for patient explanation blood test results",
  "company-brief": "find official source for company background before business meeting",
};

const name = normalizeScenario(process.argv[2], process.argv[3]);
const status = researchProviderStatus();
console.log(`research:live:verify:${name}: provider=${status.selected} configured=${status.configured}`);

if (!status.configured) {
  if (config.RESEARCH_LIVE_REQUIRED) {
    console.error("research:live:verify: provider_not_configured and RESEARCH_LIVE_REQUIRED=true");
    process.exit(1);
  }
  console.log("research:live:verify: provider_not_configured; no fake results or citations generated.");
  process.exit(0);
}

const provider = createSearchProvider();
const results = await provider.search({ query: scenarios[name], maxResults: Math.min(3, config.RESEARCH_MAX_RESULTS) });
if (results.length === 0) throw new Error("configured research provider returned zero results");
for (const result of results) {
  if (!result.url || !/^https?:\/\//i.test(result.url)) throw new Error("configured research provider returned invalid source URL");
  console.log(`research:live:verify:${name}: source domain=${domainOf(result.url)} title="${sanitize(result.title)}"`);
}
console.log(`research:live:verify:${name}: real provider sources validated; no fabricated URLs.`);

function normalizeScenario(first?: string, second?: string): ScenarioName {
  const raw = first && first !== "--" ? first : second;
  if (!raw) return "bank-apr";
  if (raw in scenarios) return raw as ScenarioName;
  throw new Error(`unknown research live scenario "${raw}"`);
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "invalid-url";
  }
}

function sanitize(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}
