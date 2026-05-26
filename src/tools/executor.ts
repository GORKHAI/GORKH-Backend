import { db } from "../db/client.js";
import { toolInvocations } from "../db/schema.js";
import { summarizeHumanContext } from "../human/profile.js";
import { findToolManifest } from "./registry.js";
import { decideToolPermission } from "./permissions.js";
import { logBrainAuditEvent } from "../brain/audit.js";

export async function invokeTool(args: { userId: string; sessionId?: string | null; name: string; input: unknown }) {
  const manifest = findToolManifest(args.name);
  const decision = manifest ? decideToolPermission(manifest) : "denied";
  if (!manifest || decision !== "allowed") {
    const [row] = await db
      .insert(toolInvocations)
      .values({
        userId: args.userId,
        sessionId: args.sessionId ?? null,
        toolName: args.name,
        input: args.input,
        output: null,
        status: "denied",
        permissionDecision: decision,
        error: manifest ? "Tool requires approval or is denied" : "Unknown tool",
        completedAt: new Date(),
      })
      .returning();
    await logBrainAuditEvent({
      userId: args.userId,
      sessionId: args.sessionId ?? null,
      eventType: "tool_invocation",
      payload: { toolName: args.name, status: "denied", permissionDecision: decision },
    }).catch(() => null);
    return row;
  }

  const output = args.name === "human_profile_read" ? await summarizeHumanContext(args.userId) : { message: "Tool is registered but has no autonomous side effect in v0." };
  const [row] = await db
    .insert(toolInvocations)
    .values({
      userId: args.userId,
      sessionId: args.sessionId ?? null,
      toolName: args.name,
      input: args.input,
      output,
      status: "completed",
      permissionDecision: decision,
      completedAt: new Date(),
    })
    .returning();
  await logBrainAuditEvent({
    userId: args.userId,
    sessionId: args.sessionId ?? null,
    eventType: "tool_invocation",
    payload: { toolName: args.name, status: "completed", permissionDecision: decision },
  }).catch(() => null);
  return row;
}
