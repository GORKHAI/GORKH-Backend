import { createLlmProvider } from "../llm/provider.js";
import { LlmProviderError } from "../llm/types.js";
import { config } from "../config.js";
import { researchAnswerSchema, type ResearchAnswer, type SearchResult } from "./types.js";

export async function composeResearchAnswer(args: {
  query: string;
  sources: SearchResult[];
  internalType?: string;
  llmRequired?: boolean;
}): Promise<ResearchAnswer> {
  if (args.sources.length === 0) {
    return { answer: "No sources were available.", citations: [], confidence: 0, limitations: "No citations were found." };
  }
  try {
    const result = await createLlmProvider().completeJson({
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
        "For medical, legal, or financial domains, include limitations and avoid final decisions.",
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
    return validateSourceBackedAnswer(result.value, args.sources);
  } catch (err) {
    if (err instanceof LlmProviderError && err.code === "provider_not_configured" && !args.llmRequired) {
      return {
        answer: "Research provider returned sources, but no LLM is configured to synthesize them. Review the source snippets directly.",
        citations: args.sources.map((source) => ({ url: source.url, title: source.title })),
        confidence: 0.4,
        limitations: "No synthesized answer was produced because the LLM provider is not configured.",
      };
    }
    throw err;
  }
}

export function validateSourceBackedAnswer(answer: ResearchAnswer, sources: SearchResult[]): ResearchAnswer {
  const sourceUrls = new Set(sources.map((source) => normalizeUrl(source.url)));
  const citations = answer.citations.filter((citation) => sourceUrls.has(normalizeUrl(citation.url)));
  if (config.RESEARCH_REQUIRE_CITATIONS && citations.length === 0) {
    throw new Error("research_answer_missing_source_backed_citations");
  }
  return {
    ...answer,
    citations,
    confidence: Math.max(0, Math.min(1, answer.confidence)),
  };
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}
