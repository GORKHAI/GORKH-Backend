import { z } from "zod";
import { config } from "../config.js";
import type { InternalType } from "../db/schema.js";
import { createLlmProvider } from "../llm/provider.js";
import type { RetrievedMemory } from "../memory/store.js";
import type { BufferedSegment } from "../redis.js";
import { systemPrompt } from "./prompts.js";
import type { TriggerEvent } from "../trigger/classifier.js";

export interface SuggestionCard {
  headline: string;
  detail: string;
  spokenCue: string;
  visualCue: string;
  kind: "ask" | "caution" | "note" | "action";
  urgency: "low" | "medium" | "high";
  confidence: number;
  delivery: "earbud" | "screen" | "haptic" | "silent";
}

const suggestionKindSchema: z.ZodType<SuggestionCard["kind"], z.ZodTypeDef, unknown> = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const normalized = value.trim().toLowerCase();
    if (["question", "clarify", "verify", "confirm"].includes(normalized)) return "ask";
    if (["warning", "warn", "risk"].includes(normalized)) return "caution";
    if (["todo", "next_step", "next-step"].includes(normalized)) return "action";
    return normalized;
  },
  z.enum(["ask", "caution", "note", "action"]),
);

export const suggestionCardInputSchema = z.object({
  headline: z.string().optional(),
  detail: z.string().optional(),
  spokenCue: z.string().optional(),
  visualCue: z.string().optional(),
  kind: suggestionKindSchema.optional(),
  urgency: z.enum(["low", "medium", "high"]).optional(),
  confidence: z.number().optional(),
  delivery: z.enum(["earbud", "screen", "haptic", "silent"]).optional(),
});

export async function suggest(input: {
  internalType: InternalType;
  context: BufferedSegment[];
  triggers: TriggerEvent[];
  memory: RetrievedMemory[];
}): Promise<SuggestionCard> {
  const provider = createLlmProvider();
  const result = await provider.completeJson({
    model: config.LLM_PROVIDER === "anthropic" ? config.SUGGEST_MODEL : config.DEEPSEEK_CHAT_MODEL,
    maxTokens: 400,
    temperature: 0,
    schemaName: "SuggestionCard",
    exampleJson: {
      headline: "Clarify total cost",
      detail: "Ask for the full repayment schedule and total cost before agreeing.",
      spokenCue: "Ask total repayment.",
      visualCue: "Ask for the repayment schedule and total cost.",
      kind: "ask",
      urgency: "high",
      confidence: 0.8,
      delivery: "earbud",
    },
    zodSchema: suggestionCardInputSchema,
    system: systemPrompt(input.internalType),
    messages: [
      {
        role: "user",
        content: [
          "LIVE TRANSCRIPT (oldest to newest):",
          input.context.map((s) => `${s.speaker}: ${s.text}`).join("\n"),
          "",
          "TRIGGERS:",
          input.triggers.map((t) => `- ${t.type}: ${t.reason} (matched: ${t.match})`).join("\n"),
          "",
          "RELEVANT MEMORY:",
          input.memory.length === 0
            ? "(none)"
            : input.memory.map((m) => `- ${m.kind}${m.subject ? ` ${m.subject}` : ""}: ${m.content}`).join("\n"),
          "",
          "Return one strict JSON object. The response must be json.",
        ].join("\n"),
      },
    ],
  });
  return normalizeSuggestionCard(result.value);
}

export function parseSuggestionCard(raw: string): SuggestionCard {
  const jsonText = extractJsonObject(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`Suggestion JSON parse failed: ${(err as Error).message}`);
  }
  const obj = suggestionCardInputSchema.parse(parsed);
  return normalizeSuggestionCard(obj);
}

export function normalizeSuggestionCard(obj: Omit<z.infer<typeof suggestionCardInputSchema>, "kind"> & { kind?: unknown }): SuggestionCard {
  const headline = (obj.headline?.trim() || "Suggestion").slice(0, 100);
  const detail = (obj.detail?.trim() || obj.visualCue?.trim() || headline).slice(0, 320);
  const visualCue = (obj.visualCue?.trim() || detail).slice(0, 180);
  const spokenCue = limitWords((obj.spokenCue?.trim() || headline).replace(/\s+/g, " "), 8);
  const kind = suggestionKindSchema.safeParse(obj.kind);
  return {
    headline,
    detail,
    spokenCue,
    visualCue,
    kind: kind.success ? kind.data : "note",
    urgency: obj.urgency ?? "medium",
    confidence: Math.max(0, Math.min(1, obj.confidence ?? 0.5)),
    delivery: obj.delivery ?? "screen",
  };
}

function extractJsonObject(raw: string): string {
  const stripped = raw.replace(/```json/gi, "```").replace(/```/g, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Suggestion JSON parse failed: no JSON object found");
  return stripped.slice(start, end + 1);
}

function limitWords(value: string, maxWords: number): string {
  const words = value.split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? value : words.slice(0, maxWords).join(" ");
}
