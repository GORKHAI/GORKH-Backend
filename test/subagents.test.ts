import { describe, expect, it } from "vitest";
import { evaluateSubagentPolicy, disabledSubagentCapabilities } from "../src/subagents/policy.js";
import { runResearchSubagent } from "../src/subagents/workers/research-subagent.js";
import { runSourceVerifierSubagent } from "../src/subagents/workers/source-verifier-subagent.js";
import type { SubagentTask } from "../src/subagents/types.js";

function task(overrides: Partial<SubagentTask>): SubagentTask {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    userId: "00000000-0000-0000-0000-000000000002",
    kind: "research",
    trigger: "user_request",
    priority: "normal",
    input: {},
    policy: {
      allowResearch: false,
      allowProfileContext: false,
      allowMemory: false,
      allowStressSupport: false,
      allowUserFacingReport: false,
      liveDelivery: "screen_only",
    },
    timeoutMs: 1000,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("subagent policy", () => {
  it("denies dangerous capabilities by design", () => {
    expect(disabledSubagentCapabilities).toContain("execute_code");
    expect(disabledSubagentCapabilities).toContain("submit_form");
    expect(disabledSubagentCapabilities).toContain("payment");
    expect(disabledSubagentCapabilities).toContain("hidden_recording");
  });

  it("requires research permission for research tasks", () => {
    expect(evaluateSubagentPolicy(task({ kind: "research" }))).toEqual({ allowed: false, reason: "research_not_allowed" });
    expect(evaluateSubagentPolicy(task({ kind: "research", policy: { ...task({}).policy, allowResearch: true } }))).toEqual({ allowed: true });
  });

  it("requires memory/profile permission for context tasks", () => {
    expect(evaluateSubagentPolicy(task({ kind: "profile_context" }))).toEqual({ allowed: false, reason: "memory_or_profile_context_not_allowed" });
  });

  it("requires explicit stress support permission", () => {
    expect(evaluateSubagentPolicy(task({ kind: "stress_support", trigger: "research_needed" }))).toEqual({ allowed: false, reason: "stress_support_not_allowed" });
  });
});

describe("subagent workers", () => {
  it("research worker returns provider_not_configured without fake citations when provider is none", async () => {
    const report = await runResearchSubagent(
      task({
        kind: "research",
        input: { query: "find official source for current APR explanation", internalType: "bank_loan" },
        policy: { ...task({}).policy, allowResearch: true, allowUserFacingReport: true },
      }),
      { signal: new AbortController().signal, emitProgress: async () => undefined },
    );
    if (report.providerStatus?.provider === "none") {
      expect(report.providerStatus.configured).toBe(false);
      expect(report.providerStatus.errorCode).toBe("provider_not_configured");
      expect(report.findings).toEqual([]);
    }
  });

  it("source verifier refuses to verify claims without sources", async () => {
    const report = await runSourceVerifierSubagent(task({ kind: "source_verifier", input: { claims: ["APR includes fees"] } }));
    expect(report.summary).toMatch(/No sources provided/i);
    expect(report.findings[0]?.citations).toBeUndefined();
  });
});
