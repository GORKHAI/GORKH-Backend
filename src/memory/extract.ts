import { z } from "zod";
import type { BufferedSegment } from "../redis.js";
import { config } from "../config.js";
import { createLlmProvider } from "../llm/provider.js";
import { storeMemories, type NewMemory } from "./store.js";

const extractedSchema = z.object({
  memories: z.array(
    z.object({
      kind: z.enum(["commitment", "fact", "person", "decision", "preference"]),
      subject: z.string().nullable().optional(),
      content: z.string().min(1).max(500),
      dueDate: z.string().datetime().nullable().optional(),
    }),
  ),
});

export async function extractAndStore(input: {
  userId: string;
  sessionId: string;
  transcript: BufferedSegment[];
}): Promise<string[]> {
  if (input.transcript.length === 0) return [];
  const provider = createLlmProvider();
  const parsed = await provider.completeJson({
    model: config.LLM_PROVIDER === "anthropic" ? config.EXTRACT_MODEL : config.DEEPSEEK_CHAT_MODEL,
    maxTokens: 800,
    temperature: 0,
    schemaName: "ExtractedMemories",
    exampleJson: {
      memories: [
        {
          kind: "commitment",
          subject: "follow-up",
          content: "User needs to send a follow-up email by Friday.",
          dueDate: null,
        },
      ],
    },
    zodSchema: extractedSchema,
    system: [
      "Extract durable user memories from a live-session transcript.",
      "Keep only useful facts, commitments, preferences, decisions, and people.",
      "Avoid highly sensitive medical or relationship details unless the transcript explicitly states the user approved remembering that detail.",
      "Return strict JSON only with shape {\"memories\":[...]} and no markdown.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: `Transcript:\n${input.transcript.map((s) => `${s.speaker}: ${s.text}`).join("\n")}\n\nReturn json only.`,
      },
    ],
  });
  const memories: NewMemory[] = parsed.value.memories.map((memory) => ({
    userId: input.userId,
    sessionId: input.sessionId,
    kind: memory.kind,
    subject: memory.subject ?? null,
    content: memory.content,
    dueDate: memory.dueDate ? new Date(memory.dueDate) : null,
  }));
  return storeMemories(memories);
}
