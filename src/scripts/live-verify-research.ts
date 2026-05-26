import { assert, fetchJson, getLiveToken, liveConfig, printSummary, requireUrl, runCheck } from "./live-verify-utils.js";

const cfg = liveConfig();
const apiUrl = requireUrl(cfg.apiUrl, "LIVE_API_URL");
const token = await getLiveToken(apiUrl, cfg);

const checks = [
  await runCheck("research provider status", async () => fetchJson(`${apiUrl}/research/providers`, { token })),
  await runCheck("research query behavior", async () => {
    const providers = await fetchJson<{ selected: string; configured: boolean }>(`${apiUrl}/research/providers`, { token });
    const result = await fetchJson<{ error?: { code: string }; sources?: Array<{ url: string }>; answer?: { citations?: unknown[] } }>(`${apiUrl}/research/query`, {
      token,
      body: { text: "official APR explanation consumer loan" },
    });
    if (!providers.configured || providers.selected === "none") {
      assert(result.error?.code === "provider_not_configured", "expected provider_not_configured without provider");
      assert((result.sources ?? []).length === 0, "no-provider path returned sources");
      return { providers, noFakeSources: true };
    }
    assert((result.sources ?? []).length > 0, "configured provider returned no source URLs");
    for (const source of result.sources ?? []) assert(Boolean(source.url), "source URL missing");
    if (result.answer) assert((result.answer.citations ?? []).length > 0, "answer had no citations");
    return { providers, sourceCount: result.sources?.length ?? 0 };
  }),
];

printSummary("live:verify:research", checks);
