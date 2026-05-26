import { LlmProviderError, type LlmJsonParams, type LlmJsonResult, type LlmProvider, type LlmTextParams, type LlmTextResult } from "./types.js";

export class NoneLlmProvider implements LlmProvider {
  readonly name = "none" as const;

  async completeText(_params: LlmTextParams): Promise<LlmTextResult> {
    throw new LlmProviderError("provider_not_configured", "LLM provider is not configured", this.name);
  }

  async completeJson<T>(_params: LlmJsonParams<T>): Promise<LlmJsonResult<T>> {
    throw new LlmProviderError("provider_not_configured", "LLM provider is not configured", this.name);
  }
}
