import { desc, eq, sql } from "drizzle-orm";
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

export async function storeMemories(items: NewMemory[]): Promise<string[]> {
  if (items.length === 0) return [];
  const vectors = await embed(items.map((item) => item.content), "document");
  const ids: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const [row] = await db
      .insert(memories)
      .values({
        userId: item.userId,
        sessionId: item.sessionId ?? null,
        kind: item.kind,
        subject: item.subject ?? null,
        content: item.content,
        dueDate: item.dueDate ?? null,
        embedding: vectors[i],
      })
      .returning({ id: memories.id });
    if (row) ids.push(row.id);
  }
  return ids;
}

export async function searchMemories(userId: string, query: string, limit = 5): Promise<RetrievedMemory[]> {
  return searchMemoriesByVector(userId, await embedOne(query, "query"), limit);
}

export async function searchMemoriesByVector(userId: string, queryVector: number[], limit = 5): Promise<RetrievedMemory[]> {
  const vectorLiteral = `[${queryVector.join(",")}]`;
  const rows = await db.execute<{
    id: string;
    kind: MemoryKind;
    subject: string | null;
    content: string;
    due_date: Date | null;
    similarity: number;
  }>(sql`
    SELECT id, kind, subject, content, due_date,
           1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM memories
    WHERE user_id = ${userId} AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${limit}
  `);
  return rows.rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    subject: row.subject,
    content: row.content,
    dueDate: row.due_date,
    similarity: Number(row.similarity),
  }));
}

export async function listKnownSubjects(userId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ subject: memories.subject })
    .from(memories)
    .where(eq(memories.userId, userId))
    .orderBy(desc(memories.subject));
  return rows.map((r) => r.subject).filter((subject): subject is string => Boolean(subject));
}
