import { describe, expect, it } from "vitest";
import { tavilyDepthForDomain, tavilyTopicForDomain } from "../src/research/tavily-tuning.js";
import { sourcePolicyForDomain } from "../src/research/source-policy.js";
import { validateResearchCitations } from "../src/research/citations.js";
import { evaluateResearchAnswer } from "../src/research/answer-evaluator.js";
import { evaluateCueQuality } from "../src/evaluation/cue-quality.js";
import { routeWork } from "../src/governor/router.js";
import { normalizeProviderUsage } from "../src/evaluation/cost.js";

describe("research quality and governor", () => {
  it("selects Tavily topics and depth by domain/query", () => {
    expect(tavilyTopicForDomain("news/current", "latest bank rules")).toBe("news");
    expect(tavilyTopicForDomain("finance", "stock market price")).toBe("finance");
    expect(tavilyDepthForDomain("doctor_visit", "blood test results")).toBe("advanced");
  });

  it("defines high-stakes source policy", () => {
    const policy = sourcePolicyForDomain("bank_loan");
    expect(policy.highStakes).toBe(true);
    expect(policy.minCitations).toBeGreaterThanOrEqual(1);
    expect(policy.preferredSourceTypes).toContain("official");
  });

  it("rejects fabricated citation URLs", () => {
    const result = validateResearchCitations({
      domain: "general",
      sources: [{ title: "Real", url: "https://example.com/real", snippet: "real", sourceType: "company" }],
      answer: { answer: "Fake citation.", citations: [{ title: "Fake", url: "https://fake.example/missing" }], confidence: 0.2, limitations: "Limited." },
    });
    expect(result.ok).toBe(false);
    expect(result.quality.unsupportedClaimCount).toBeGreaterThan(0);
  });

  it("accepts source-backed citations", () => {
    const result = validateResearchCitations({
      domain: "general",
      sources: [{ title: "Real", url: "https://example.com/real", snippet: "real", sourceType: "company" }],
      answer: { answer: "Source-backed.", citations: [{ title: "Real", url: "https://example.com/real" }], confidence: 0.8, limitations: "Limited." },
    });
    expect(result.quality.sourceBacked).toBe(true);
  });

  it("warns when high-stakes answer lacks limitation", () => {
    const evaluation = evaluateResearchAnswer({
      query: "APR loan fees",
      domain: "bank_loan",
      sources: [{ title: "Official", url: "https://www.consumerfinance.gov/example", snippet: "APR", sourceType: "official" }],
      answer: { answer: "APR includes some fees.", citations: [{ title: "Official", url: "https://www.consumerfinance.gov/example" }], confidence: 0.8 },
    });
    expect(evaluation.status).toBe("warning");
    expect(evaluation.findings).toContain("high_stakes_answer_missing_limitation");
  });

  it("evaluates cue word limit and latency shape", () => {
    const result = evaluateCueQuality({
      cueText: "Ask total repayment in writing now please",
      transcriptReceivedAt: 100,
      cueEmittedAt: 1400,
      delivery: "earbud",
    });
    expect(result.metrics.transcriptToCueMs).toBe(1300);
    expect(result.findings).toContain("cue_latency_above_target");
  });

  it("routes deterministic and budget-exceeded paths", () => {
    expect(routeWork({ operation: "voice_prep", deterministicAvailable: true }).step).toBe("deterministic");
    expect(routeWork({ operation: "open_chat", budgetAvailable: false }).errorCode).toBe("provider_budget_exceeded");
  });

  it("normalizes provider usage without fake cost", () => {
    const usage = normalizeProviderUsage({ inputTokens: 10, outputTokens: 2 });
    expect(usage.inputTokens).toBe(10);
    expect(usage.estimatedCostUsd).toBeNull();
  });
});
