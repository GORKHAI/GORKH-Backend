import Anthropic from "@anthropic-ai/sdk";
import { config, requireKey } from "../config.js";
import { systemPrompt } from "./prompts.js";
import type { SessionMode } from "../db/schema.js";
import type { TriggerEvent } from "../trigger/classifier.js";
import type { BufferedSegment } from "../redis.js";
import type { RetrievedMemory } from "../memory/store.js";

export interface SuggestionCard {
  headline: string;
  detail: string;
  kind: "ask" | "caution" | "note" | "action";
  confidence: number;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  const key = requireKey(config.ANTHROPIC_API_KEY, "Anthropic (ANTHROPIC_API_KEY)");
  if (!client) client = new Anthropic({ apiKey: key });
  return client;
}

function renderContext(segments: BufferedSegment[]): string {
  return segments.map((s) => `${s.speaker}: ${s.text}`).join("\n");
}

function renderTriggers(triggers: TriggerEvent[]): string {
  return triggers.map((t) => `- [${t.type}] ${t.reason} (matched: "${t.match}")`).join("\n");
}

function renderMemory(mem: RetrievedMemory[]): string {
  if (mem.length === 0) return "(none)";
  return mem
    .map((m) => `- (${m.kind}${m.subject ? `, re: ${m.subject}` : ""}) ${m.content}`)
    .join("\n");
}

/**
 * Produce a single suggestion card. Real Anthropic Messages API call.
 * Throws a clear error if ANTHROPIC_API_KEY is unset (never fabricates a card).
 */
export async function suggest(input: {
  mode: SessionMode;
  context: BufferedSegment[];
  triggers: TriggerEvent[];
  memory: RetrievedMemory[];
}): Promise<SuggestionCard> {
  const anthropic = getClient();

  const userContent = [
    "LIVE TRANSCRIPT (oldest to newest):",
    renderContext(input.context),
    "",
    "WHAT JUST TRIGGERED YOU:",
    renderTriggers(input.triggers),
    "",
    "RELEVANT MEMORY ABOUT THIS USER:",
    renderMemory(input.memory),
    "",
    "Return the single most useful suggestion card as strict JSON now.",
  ].join("\n");

  const msg = await anthropic.messages.create({
    model: config.SUGGEST_MODEL,
    max_tokens: 300,
    system: systemPrompt(input.mode),
    messages: [{ role: "user", content: userContent }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return parseCard(text);
}

/** Robustly parse the model's JSON, tolerating stray fences/prose. */
export function parseCard(raw: string): SuggestionCard {
  let s = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1);

  const obj = JSON.parse(s) as Partial<SuggestionCard>;
  const kind = obj.kind ?? "note";
  const allowed = ["ask", "caution", "note", "action"] as const;
  return {
    headline: String(obj.headline ?? "").slice(0, 120),
    detail: String(obj.detail ?? "").slice(0, 280),
    kind: (allowed as readonly string[]).includes(kind) ? (kind as SuggestionCard["kind"]) : "note",
    confidence:
      typeof obj.confidence === "number" ? Math.max(0, Math.min(1, obj.confidence)) : 0.5,
  };
}
