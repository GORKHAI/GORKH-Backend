import { createLlmProvider } from "../llm/provider.js";
import { LlmProviderError } from "../llm/types.js";
import { config } from "../config.js";
import { recordProviderUsage } from "../governor/budget.js";
import { researchAnswerSchema, type ResearchAnswer, type SearchResult } from "./types.js";
import { validateResearchCitations } from "./citations.js";
import { classifyResearchDomain, sourcePolicyForDomain } from "./source-policy.js";

export async function composeResearchAnswer(args: {
  query: string;
  sources: SearchResult[];
  internalType?: string;
  llmRequired?: boolean;
}): Promise<ResearchAnswer> {
  if (args.sources.length === 0) {
    return { answer: "No sources were available.", citations: [], confidence: 0, limitations: "No citations were found." };
  }
  const domain = classifyResearchDomain({ text: args.query, internalType: args.internalType });
  const policy = sourcePolicyForDomain(domain);
  try {
    const provider = createLlmProvider();
    const startedAt = Date.now();
    const result = await provider.completeJson({
      schemaName: "ResearchAnswer",
      zodSchema: researchAnswerSchema,
      exampleJson: {
        answer: "Short answer grounded only in the provided sources.",
        citations: [{ url: "https://example.com", title: "Example source" }],
        confidence: 0.6,
        limitations: "Limited by available sources.",
      },
      system: [
        "Return strict json only.",
        "Use only the supplied source snippets. Do not invent citations.",
        "Every citation URL must exactly match one supplied source URL.",
        "For medical, legal, or financial domains, include limitations and avoid final decisions.",
        policy.safetyCaveat ? `Required limitation/caveat: ${policy.safetyCaveat}` : "",
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: JSON.stringify({ query: args.query, internalType: args.internalType ?? "general", sources: args.sources }),
        },
      ],
      temperature: 0.1,
      maxTokens: 700,
    });
    await recordProviderUsage({
      provider: result.provider,
      model: result.model,
      operation: "research.compose_json",
      usage: result.usage,
      latencyMs: Date.now() - startedAt,
      status: "completed",
    }).catch(() => null);
    const validated = validateSourceBackedAnswer(result.value, args.sources, domain);
    return policy.highStakes && !validated.limitations ? { ...validated, limitations: policy.safetyCaveat ?? "High-stakes information requires verification." } : validated;
  } catch (err) {
    if (err instanceof LlmProviderError && err.code === "provider_not_configured" && !args.llmRequired) {
      return sourceListOnlyAnswer(args.sources, "No synthesized answer was produced because the LLM provider is not configured.");
    }
    const unsafeLlmOutput =
      err instanceof LlmProviderError && err.code === "llm_json_parse_error"
        ? true
        : err instanceof Error && err.message === "research_answer_missing_source_backed_citations";
    if (unsafeLlmOutput && !args.llmRequired) {
      return sourceListOnlyAnswer(args.sources, "No synthesized answer was produced because the LLM output was not valid source-backed JSON.");
    }
    throw err;
  }
}

function sourceListOnlyAnswer(sources: SearchResult[], limitations: string): ResearchAnswer {
  return {
    answer: "Research provider returned source results. Review the cited source snippets directly; no synthesized answer was produced.",
    citations: sources.map((source) => ({ url: source.url, title: source.title })),
    confidence: 0.4,
    limitations,
  };
}

export function validateSourceBackedAnswer(answer: ResearchAnswer, sources: SearchResult[], domain = classifyResearchDomain({ text: "" })): ResearchAnswer {
  const validation = validateResearchCitations({ answer, sources, domain });
  const citations = validation.citations;
  if (config.RESEARCH_REQUIRE_CITATIONS && !validation.ok) {
    const sourceBackedError =
      validation.quality.unsupportedClaimCount > 0 || validation.quality.citationCount === 0 || validation.errorCode?.startsWith("citation_");
    throw new Error(sourceBackedError ? "research_answer_missing_source_backed_citations" : (validation.errorCode ?? "research_answer_missing_source_backed_citations"));
  }
  return {
    ...answer,
    citations,
    confidence: Math.max(0, Math.min(1, answer.confidence)),
  };
}
