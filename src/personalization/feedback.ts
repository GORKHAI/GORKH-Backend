import { db } from "../db/client.js";
import { userFeedbackEvents, type FeedbackTargetType } from "../db/schema.js";

export async function recordFeedback(args: {
  userId: string;
  sessionId?: string | null;
  targetType: FeedbackTargetType;
  targetId?: string | null;
  rating?: number | null;
  feedback?: string | null;
  outcome?: string | null;
}) {
  const [row] = await db
    .insert(userFeedbackEvents)
    .values({
      userId: args.userId,
      sessionId: args.sessionId ?? null,
      targetType: args.targetType,
      targetId: args.targetId ?? null,
      rating: args.rating ?? null,
      feedback: args.feedback ?? null,
      outcome: args.outcome ?? null,
    })
    .returning();
  return row;
}
