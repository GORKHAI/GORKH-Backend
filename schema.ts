import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  vector,
  index,
} from "drizzle-orm/pg-core";
import { config } from "../config.js";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SessionMode = "personal" | "meeting" | "bank" | "negotiation";
export type SessionStatus = "active" | "stopped" | "saved" | "discarded";

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  mode: text("mode").$type<SessionMode>().notNull(),
  status: text("status").$type<SessionStatus>().notNull().default("active"),
  title: text("title"),
  consentGranted: boolean("consent_granted").notNull().default(false),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const transcriptSegments = pgTable(
  "transcript_segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    speaker: text("speaker").notNull(), // "me" | "speaker_0" | "speaker_1" ...
    text: text("text").notNull(),
    isFinal: boolean("is_final").notNull().default(true),
    offsetMs: integer("offset_ms").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bySession: index("transcript_by_session").on(t.sessionId),
  }),
);

export type MemoryKind = "commitment" | "fact" | "person" | "decision" | "preference";

export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    kind: text("kind").$type<MemoryKind>().notNull(),
    subject: text("subject"), // e.g. a person's name the memory is about
    content: text("content").notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }),
    embedding: vector("embedding", { dimensions: config.VOYAGE_EMBED_DIM }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("memories_by_user").on(t.userId),
    // IVFFlat/HNSW index for cosine search is created in migrate.ts via raw SQL
    // because it requires the operator class which drizzle-kit cannot express.
  }),
);

export const suggestions = pgTable("suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  triggerType: text("trigger_type").notNull(),
  card: jsonb("card").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type TranscriptSegment = typeof transcriptSegments.$inferSelect;
export type Memory = typeof memories.$inferSelect;
export type Suggestion = typeof suggestions.$inferSelect;
