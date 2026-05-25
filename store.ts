import { sql, eq, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { memories, type MemoryKind } from "../db/schema.js";
import { embed, embedOne } from "./embeddings.js";

export interface NewMemory {
  userId: string;
  sessionId?: string | null;
  kind: MemoryKind;
  subject?: string | null;
  content: string;
  dueDate?: Date | null;
}

export interface RetrievedMemory {
  id: string;
  kind: MemoryKind;
  subject: string | null;
  content: string;
  dueDate: Date | null;
  similarity: number;
}

/** Format a JS number[] as a pgvector literal: "[0.1,0.2,...]". */
function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

/**
 * Persist memories, embedding their content with Voyage. Embedding is batched
 * in a single Voyage call. Throws if Voyage is not configured.
 */
export async function storeMemories(items: NewMemory[]): Promise<string[]> {
  if (items.length === 0) return [];
  const vectors = await embed(
    items.map((i) => i.content),
    "document",
  );

  const ids: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    const vec = vectors[i]!;
    const [row] = await db
      .insert(memories)
      .values({
        userId: it.userId,
        sessionId: it.sessionId ?? null,
        kind: it.kind,
        subject: it.subject ?? null,
        content: it.content,
        dueDate: it.dueDate ?? null,
        embedding: vec,
      })
      .returning({ id: memories.id });
    if (row) ids.push(row.id);
  }
  return ids;
}

/**
 * Insert a memory with a caller-supplied embedding vector. Used by integration
 * tests (deterministic fixture vectors) and by callers that already embedded.
 */
export async function storeMemoryWithVector(
  item: NewMemory,
  vector: number[],
): Promise<string> {
  const [row] = await db
    .insert(memories)
    .values({
      userId: item.userId,
      sessionId: item.sessionId ?? null,
      kind: item.kind,
      subject: item.subject ?? null,
      content: item.content,
      dueDate: item.dueDate ?? null,
      embedding: vector,
    })
    .returning({ id: memories.id });
  if (!row) throw new Error("insert returned no row");
  return row.id;
}

/**
 * Semantic search: return the user's memories most similar to `query`,
 * ranked by cosine similarity (1 - cosine_distance). Embeds the query via Voyage.
 */
export async function searchMemories(
  userId: string,
  query: string,
  limit = 5,
): Promise<RetrievedMemory[]> {
  const qVec = await embedOne(query, "query");
  return searchMemoriesByVector(userId, qVec, limit);
}

/** Same as searchMemories but with a pre-computed query vector. */
export async function searchMemoriesByVector(
  userId: string,
  queryVector: number[],
  limit = 5,
): Promise<RetrievedMemory[]> {
  const lit = toVectorLiteral(queryVector);
  const rows = await db.execute<{
    id: string;
    kind: MemoryKind;
    subject: string | null;
    content: string;
    due_date: Date | null;
    similarity: number;
  }>(sql`
    SELECT id, kind, subject, content, due_date,
           1 - (embedding <=> ${lit}::vector) AS similarity
    FROM memories
    WHERE user_id = ${userId} AND embedding IS NOT NULL
    ORDER BY embedding <=> ${lit}::vector
    LIMIT ${limit}
  `);
  return rows.rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    subject: r.subject,
    content: r.content,
    dueDate: r.due_date,
    similarity: Number(r.similarity),
  }));
}

/**
 * Distinct subjects the user has memory about (people, projects, topics).
 * Fed to the trigger classifier so it can flag when a known subject is spoken.
 */
export async function listKnownSubjects(userId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ subject: memories.subject })
    .from(memories)
    .where(eq(memories.userId, userId))
    .orderBy(desc(memories.subject));
  return rows.map((r) => r.subject).filter((s): s is string => !!s);
}
