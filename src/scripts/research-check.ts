import { config } from "../config.js";
import { createSearchProvider, researchProviderStatus } from "../research/provider.js";
import { ResearchProviderError } from "../research/types.js";

async function main(): Promise<void> {
  const status = researchProviderStatus();
  console.log(`research:check: selected=${status.selected} configured=${status.configured}`);
  if (!status.configured) {
    console.log("research:check: provider_not_configured; no fake results generated.");
    return;
  }
  try {
    const provider = createSearchProvider();
    const results = await provider.search({
      query: "official APR explanation consumer loan",
      maxResults: Math.min(3, config.RESEARCH_MAX_RESULTS),
    });
    if (results.length === 0) throw new Error("provider returned zero results");
    for (const result of results) {
      console.log(`research:check: result title="${redact(result.title)}" domain=${domainOf(result.url)}`);
    }
  } catch (err) {
    if (err instanceof ResearchProviderError && err.code === "provider_not_configured") {
      console.log("research:check: provider_not_configured; no fake results generated.");
      return;
    }
    throw err;
  }
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "invalid-url";
  }
}

function redact(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 120);
}

main().catch((err) => {
  console.error(`research:check: failed: ${(err as Error).message}`);
  process.exit(1);
});
