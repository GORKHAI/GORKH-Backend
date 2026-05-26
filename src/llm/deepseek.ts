import OpenAI from "openai";
import { config } from "../config.js";
import { parseJsonObject } from "./json.js";
import { LlmProviderError, type LlmJsonParams, type LlmJsonResult, type LlmProvider, type LlmTextParams, type LlmTextResult, type LlmUsage } from "./types.js";

let client: OpenAI | null = null;

function deepseekClient(): OpenAI {
  if (!config.DEEPSEEK_API_KEY) {
    throw new LlmProviderError("provider_not_configured", "DeepSeek (DEEPSEEK_API_KEY) is not configured", "deepseek");
  }
  client ??= new OpenAI({
    apiKey: config.DEEPSEEK_API_KEY,
    baseURL: config.DEEPSEEK_BASE_URL,
    timeout: config.DEEPSEEK_TIMEOUT_MS,
    maxRetries: config.DEEPSEEK_MAX_RETRIES,
  });
  return client;
}

export class DeepSeekLlmProvider implements LlmProvider {
  readonly name = "deepseek" as const;

  async completeText(params: LlmTextParams): Promise<LlmTextResult> {
    const model = params.model ?? config.DEEPSEEK_CHAT_MODEL;
    try {
      const response = await deepseekClient().chat.completions.create(
        {
          model,
          temperature: params.temperature ?? 0.2,
          max_tokens: params.maxTokens ?? 600,
          messages: toOpenAiMessages(params.system, params.messages),
        },
        { signal: params.signal },
      );
      const text = response.choices[0]?.message?.content?.trim();
      if (!text) throw new LlmProviderError("llm_request_failed", "DeepSeek returned empty content", this.name);
      return { text, provider: this.name, model, usage: mapUsage(response.usage), raw: response };
    } catch (err) {
      if (err instanceof LlmProviderError) throw err;
      throw new LlmProviderError("llm_request_failed", `DeepSeek request failed: ${(err as Error).message}`, this.name, err);
    }
  }

  async completeJson<T>(params: LlmJsonParams<T>): Promise<LlmJsonResult<T>> {
    const model = params.model ?? config.DEEPSEEK_CHAT_MODEL;
    const system = [
      params.system,
      `Return strict json only for schema "${params.schemaName}".`,
      `Example JSON object: ${JSON.stringify(params.exampleJson)}`,
    ].join("\n");
    try {
      const response = await deepseekClient().chat.completions.create(
        {
          model,
          temperature: params.temperature ?? 0,
          max_tokens: params.maxTokens ?? 700,
          response_format: { type: "json_object" },
          messages: toOpenAiMessages(system, [
            ...params.messages,
            { role: "user", content: "Return one valid JSON object only. Do not include markdown." },
          ]),
        },
        { signal: params.signal },
      );
      const rawText = response.choices[0]?.message?.content?.trim();
      if (!rawText) throw new LlmProviderError("llm_json_parse_error", "DeepSeek returned empty JSON content", this.name);
      const parsed = parseJsonObject(rawText, this.name);
      return { value: params.zodSchema.parse(parsed), rawText, provider: this.name, model, usage: mapUsage(response.usage), raw: response };
    } catch (err) {
      if (err instanceof LlmProviderError) throw err;
      throw new LlmProviderError("llm_request_failed", `DeepSeek JSON request failed: ${(err as Error).message}`, this.name, err);
    }
  }
}

function toOpenAiMessages(system: string, messages: LlmTextParams["messages"]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))];
}

function mapUsage(usage: OpenAI.Chat.Completions.ChatCompletion["usage"] | undefined): LlmUsage | undefined {
  if (!usage) return undefined;
  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    cachedInputTokens: usage.prompt_tokens_details?.cached_tokens,
  };
}
