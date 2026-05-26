import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { parseJsonObject } from "./json.js";
import { LlmProviderError, type LlmJsonParams, type LlmJsonResult, type LlmProvider, type LlmTextParams, type LlmTextResult, type LlmUsage } from "./types.js";

let client: Anthropic | null = null;

function anthropicClient(): Anthropic {
  if (!config.ANTHROPIC_API_KEY) {
    throw new LlmProviderError("provider_not_configured", "Anthropic (ANTHROPIC_API_KEY) is not configured", "anthropic");
  }
  client ??= new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  return client;
}

export class AnthropicLlmProvider implements LlmProvider {
  readonly name = "anthropic" as const;

  async completeText(params: LlmTextParams): Promise<LlmTextResult> {
    const model = params.model ?? config.ANTHROPIC_MODEL;
    try {
      const response = await anthropicClient().messages.create(
        {
          model,
          max_tokens: params.maxTokens ?? 600,
          temperature: params.temperature ?? 0.2,
          system: params.system,
          messages: params.messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
        },
        { signal: params.signal },
      );
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("")
        .trim();
      if (!text) throw new LlmProviderError("llm_request_failed", "Anthropic returned empty content", this.name);
      return { text, provider: this.name, model, usage: mapUsage(response.usage), raw: response };
    } catch (err) {
      if (err instanceof LlmProviderError) throw err;
      throw new LlmProviderError("llm_request_failed", `Anthropic request failed: ${(err as Error).message}`, this.name, err);
    }
  }

  async completeJson<T>(params: LlmJsonParams<T>): Promise<LlmJsonResult<T>> {
    const model = params.model ?? config.ANTHROPIC_MODEL;
    const textResult = await this.completeText({
      ...params,
      model,
      temperature: params.temperature ?? 0,
      system: [
        params.system,
        `Return strict JSON only for schema "${params.schemaName}". No markdown.`,
        `Example JSON object: ${JSON.stringify(params.exampleJson)}`,
      ].join("\n"),
      messages: [...params.messages, { role: "user", content: "Return one valid JSON object only." }],
    });
    const parsed = parseJsonObject(textResult.text, this.name);
    return { value: params.zodSchema.parse(parsed), rawText: textResult.text, provider: this.name, model, usage: textResult.usage, raw: textResult.raw };
  }
}

function mapUsage(usage: Anthropic.Usage | undefined): LlmUsage | undefined {
  if (!usage) return undefined;
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cachedInputTokens: usage.cache_read_input_tokens ?? undefined,
  };
}
