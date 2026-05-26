import type { z } from "zod";

export type LlmProviderName = "none" | "deepseek" | "anthropic";

export type LlmMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export interface LlmUsage {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
}

export interface LlmTextParams {
  system: string;
  messages: LlmMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
}

export interface LlmJsonParams<T> extends LlmTextParams {
  schemaName: string;
  exampleJson: unknown;
  zodSchema: z.ZodType<T>;
}

export interface LlmTextResult {
  text: string;
  provider: string;
  model: string;
  usage?: LlmUsage;
  raw?: unknown;
}

export interface LlmJsonResult<T> {
  value: T;
  rawText: string;
  provider: string;
  model: string;
  usage?: LlmUsage;
  raw?: unknown;
}

export interface LlmProvider {
  readonly name: LlmProviderName;
  completeText(params: LlmTextParams): Promise<LlmTextResult>;
  completeJson<T>(params: LlmJsonParams<T>): Promise<LlmJsonResult<T>>;
}

export class LlmProviderError extends Error {
  constructor(
    readonly code: "provider_not_configured" | "llm_json_parse_error" | "llm_request_failed",
    message: string,
    readonly provider: LlmProviderName,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LlmProviderError";
  }
}
