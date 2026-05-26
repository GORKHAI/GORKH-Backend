import { z } from "zod";
import { config, requireKey } from "../config.js";

const responseSchema = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()) })),
});

export async function embedOne(input: string, inputType: "query" | "document"): Promise<number[]> {
  const [vector] = await embed([input], inputType);
  if (!vector) throw new Error("Voyage returned no embedding");
  return vector;
}

export async function embed(inputs: string[], inputType: "query" | "document"): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const key = requireKey(config.VOYAGE_API_KEY, "Voyage (VOYAGE_API_KEY)");
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: inputs,
      model: config.VOYAGE_MODEL,
      input_type: inputType,
    }),
  });
  if (!response.ok) {
    throw new Error(`Voyage embeddings failed: HTTP ${response.status} ${await response.text()}`);
  }
  const parsed = responseSchema.parse(await response.json());
  return parsed.data.map((item) => item.embedding);
}
