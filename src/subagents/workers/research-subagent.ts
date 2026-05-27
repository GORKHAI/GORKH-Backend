import { config } from "../../config.js";
import { persistEvaluation } from "../../evaluation/research-quality.js";
import { createSearchProvider, researchProviderStatus } from "../../research/provider.js";
import { detectResearchNeed } from "../../research/need-detector.js";
import { ResearchProviderError } from "../../research/types.js";
import { classifySource, scoreSource } from "../../research/verifier.js";
import { planResearchQuery } from "../../research/query-planner.js";
import { scoreResearchSources } from "../../research/quality.js";
import type { SubagentReport, SubagentTask, SubagentWorkerContext } from "../types.js";

export async function runResearchSubagent(task: SubagentTask, context: SubagentWorkerContext): Promise<SubagentReport> {
  const input = normalizeInput(task.input);
  const status = context.researchProviderStatus?.() ?? researchProviderStatus();
  await context.emitProgress("Checking research provider...");
  if (!task.policy.allowResearch) {
    return failed(task, "Research not allowed by policy.", status.selected, status.configured, "research_not_allowed");
  }
  const plan = planResearchQuery({ text: input.query, internalType: input.internalType, intent: input.intent, maxResults: input.maxResults ?? config.RESEARCH_MAX_RESULTS });
  const decision = detectResearchNeed({ text: input.query, internalType: input.internalType });
  if (!decision.needsResearch && input.intent !== "source_verification") {
    return {
      taskId: task.id,
      kind: "research",
      status: "completed",
      title: "No research needed",
      summary: "The request did not require live web research.",
      findings: [{ claim: "No live source lookup was needed for this request.", confidence: 0.8 }],
      recommendedMainAgentMessage: "No live source lookup was needed.",
      safetyNotes: ["No web sources were queried."],
      providerStatus: { provider: status.selected, configured: status.configured },
      createdAt: new Date().toISOString(),
    };
  }
  try {
    await context.emitProgress("Searching public sources...");
    const provider = (context.createSearchProvider ?? createSearchProvider)();
    const results = await provider.search({
      query: decision.suggestedQuery ?? plan.normalizedQuery,
      maxResults: plan.maxResults,
      signal: context.signal,
    });
    if (context.signal.aborted) throw new Error("subagent task canceled");
    const sources = results.map((result) => ({
      ...result,
      sourceType: result.sourceType ?? classifySource(result.url),
      credibilityScore: scoreSource(result, plan.domain),
    }));
    await context.emitProgress(`Verified ${sources.length} source result(s).`);
    const sourceQuality = scoreResearchSources(sources, plan.domain);
    await persistEvaluation({
      userId: task.userId,
      sessionId: task.sessionId ?? null,
      result: {
        targetType: "subagent_report",
        targetId: task.id,
        evaluator: "subagent_research_quality_v0",
        score: Math.max(0, Math.min(1, sourceQuality.averageCredibility)),
        status: sourceQuality.warnings.length ? "warning" : "passed",
        metrics: { sourceQuality, domain: plan.domain, citationMinimum: plan.minCitations },
        findings: sourceQuality.warnings,
      },
    }).catch(() => null);
    return {
      taskId: task.id,
      kind: "research",
      status: "completed",
      title: "Research complete",
      summary: sources.length > 0 ? `Found ${sources.length} public source result(s).` : "No public source results were returned.",
      findings: sources.slice(0, input.maxResults ?? 6).map((source) => ({
        claim: source.snippet || source.title,
        confidence: Math.max(0, Math.min(1, source.credibilityScore ?? 0.45)),
        citations: [{ title: source.title, url: source.url }],
        limitation: source.sourceType === "forum" || source.sourceType === "unknown" ? "Low-confidence source type." : undefined,
      })),
      recommendedMainAgentMessage:
        task.policy.liveDelivery === "screen_only"
          ? "Research is ready on screen. Ask whether fees are included in APR and request total repayment in writing."
          : "I found sources. Ask whether fees are included in APR and request total repayment in writing.",
      safetyNotes: ["Do not make final financial, legal, or medical decisions from this report alone."],
      providerStatus: { provider: provider.name, configured: true },
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof ResearchProviderError || /configured/i.test((err as Error).message)) {
      return failed(task, "Research provider is not configured.", status.selected, false, "provider_not_configured");
    }
    throw err;
  }
}

function normalizeInput(input: unknown): { query: string; intent?: string; internalType?: string; maxResults?: number; requireCitations?: boolean } {
  const value = (input ?? {}) as Record<string, unknown>;
  return {
    query: String(value.query ?? ""),
    intent: typeof value.intent === "string" ? value.intent : undefined,
    internalType: typeof value.internalType === "string" ? value.internalType : typeof value.intent === "string" ? value.intent : undefined,
    maxResults: typeof value.maxResults === "number" ? value.maxResults : undefined,
    requireCitations: typeof value.requireCitations === "boolean" ? value.requireCitations : undefined,
  };
}

function failed(task: SubagentTask, summary: string, provider: string, configured: boolean, errorCode: string): SubagentReport {
  return {
    taskId: task.id,
    kind: "research",
    status: "failed",
    title: "Research unavailable",
    summary,
    findings: [],
    recommendedMainAgentMessage: "I can't verify live web sources yet because research provider is not configured.",
    safetyNotes: ["No sources or citations were fabricated."],
    providerStatus: { provider, configured, errorCode },
    createdAt: new Date().toISOString(),
  };
}
