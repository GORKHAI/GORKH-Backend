import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { providerUsageEvents, users } from "../db/schema.js";
import { runMigration } from "./migrate.js";
import { validateResearchCitations } from "../research/citations.js";
import { evaluateResearchAnswerQuality, persistEvaluation } from "../evaluation/research-quality.js";
import { evaluateCueQuality } from "../evaluation/cue-quality.js";
import { routeWork } from "../governor/router.js";
import { recordProviderUsage } from "../governor/budget.js";
import { createSearchProvider, researchProviderStatus } from "../research/provider.js";
import { classifySource, scoreSource } from "../research/verifier.js";
import { composeResearchAnswer } from "../research/composer.js";
import { planResearchQuery } from "../research/query-planner.js";

type ReplayName =
  | "tavily-bank-apr"
  | "citation-validation"
  | "no-fake-citation"
  | "cue-latency"
  | "governor-deterministic"
  | "governor-budget"
  | "provider-usage";

const replay = (process.argv[2] ?? "citation-validation") as ReplayName;
await runMigration();
const user = await ensureUser();

if (replay === "tavily-bank-apr") {
  const status = researchProviderStatus();
  console.log(`quality:replay:tavily-bank-apr provider=${status.selected} configured=${status.configured}`);
  if (!status.configured) {
    console.log("provider_not_configured; no fake citations generated.");
    process.exit(0);
  }
  const plan = planResearchQuery({ text: "official APR explanation consumer loan", internalType: "bank_loan", maxResults: 3 });
  const provider = createSearchProvider();
  const sources = (await provider.search({ query: plan.normalizedQuery, maxResults: 3 })).map((source) => ({
    ...source,
    sourceType: source.sourceType ?? classifySource(source.url),
    credibilityScore: scoreSource(source, plan.domain),
  }));
  if (sources.length === 0) throw new Error("configured provider returned no sources");
  const answer = await composeResearchAnswer({ query: plan.originalText, sources, internalType: "bank_loan" });
  const validation = validateResearchCitations({ answer, sources, domain: plan.domain });
  if (!validation.ok) throw new Error(`citation validation failed: ${validation.errorCode}`);
  console.log(`validated ${validation.quality.citationCount} source-backed citation(s)`);
  process.exit(0);
}

if (replay === "citation-validation") {
  const sources = [
    { title: "Official APR Guide", url: "https://www.consumerfinance.gov/example", snippet: "APR includes interest and certain fees.", sourceType: "official" as const },
    { title: "Official Loan Cost Guide", url: "https://www.consumerfinance.gov/example-cost", snippet: "Review total loan costs.", sourceType: "official" as const },
  ];
  const answer = {
    answer: "Sources indicate APR includes interest and certain fees.",
    citations: sources.map((source) => ({ url: source.url, title: source.title })),
    confidence: 0.8,
    limitations: "Verify current terms with the lender.",
  };
  const validation = validateResearchCitations({ answer, sources, domain: "bank_loan" });
  if (!validation.ok) throw new Error("expected source-backed citation to pass");
  console.log(`citation-validation: score=${validation.quality.overallCitationScore}`);
  process.exit(0);
}

if (replay === "no-fake-citation") {
  const sources = [{ title: "Real Source", url: "https://example.com/real", snippet: "snippet", sourceType: "company" as const }];
  const answer = { answer: "Unsupported answer.", citations: [{ url: "https://fake.example/not-in-source-set", title: "Fake" }], confidence: 0.2, limitations: "Limited." };
  const validation = validateResearchCitations({ answer, sources, domain: "general" });
  if (validation.ok) throw new Error("fabricated citation was accepted");
  console.log(`no-fake-citation: rejected=${validation.errorCode}`);
  process.exit(0);
}

if (replay === "cue-latency") {
  const result = evaluateCueQuality({ cueText: "Ask total repayment.", transcriptReceivedAt: Date.now() - 320, cueEmittedAt: Date.now(), delivery: "earbud" });
  await persistEvaluation({ userId: user.id, result });
  console.log(`cue-latency: status=${result.status} latency=${String(result.metrics.transcriptToCueMs)}`);
  process.exit(0);
}

if (replay === "governor-deterministic") {
  const decision = routeWork({ deterministicAvailable: true, operation: "voice_prep" });
  if (decision.step !== "deterministic") throw new Error("expected deterministic governor route");
  console.log(`governor-deterministic: ${decision.reason}`);
  process.exit(0);
}

if (replay === "governor-budget") {
  const decision = routeWork({ deterministicAvailable: false, budgetAvailable: false, operation: "open_chat" });
  if (decision.errorCode !== "provider_budget_exceeded") throw new Error("expected budget exceeded decision");
  console.log(`governor-budget: ${decision.errorCode}`);
  process.exit(0);
}

if (replay === "provider-usage") {
  await recordProviderUsage({ userId: user.id, provider: "deepseek", model: config.DEEPSEEK_CHAT_MODEL, operation: "quality_replay", usage: { inputTokens: 1, outputTokens: 1 }, latencyMs: 12, status: "completed" });
  const [event] = await db.select().from(providerUsageEvents).where(eq(providerUsageEvents.userId, user.id)).limit(1);
  if (!event) throw new Error("provider usage event was not stored");
  console.log(`provider-usage: stored=${event.provider}:${event.operation}`);
  process.exit(0);
}

throw new Error(`unknown quality replay "${replay}"`);

async function ensureUser() {
  const email = `quality-${randomUUID()}@example.com`;
  const [row] = await db.insert(users).values({ email, displayName: "Quality Replay" }).returning();
  if (!row) throw new Error("failed to create replay user");
  return row;
}
