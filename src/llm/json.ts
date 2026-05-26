import { LlmProviderError, type LlmProviderName } from "./types.js";

export function extractJsonObject(raw: string, provider: LlmProviderName): string {
  const stripped = raw.replace(/```json/gi, "```").replace(/```/g, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new LlmProviderError("llm_json_parse_error", "LLM JSON parse failed: no JSON object found", provider);
  }
  return stripped.slice(start, end + 1);
}

export function parseJsonObject(raw: string, provider: LlmProviderName): unknown {
  const jsonText = extractJsonObject(raw, provider);
  try {
    return JSON.parse(jsonText);
  } catch (err) {
    throw new LlmProviderError("llm_json_parse_error", `LLM JSON parse failed: ${(err as Error).message}`, provider, err);
  }
}
