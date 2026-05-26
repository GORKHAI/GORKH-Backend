import { classifySource, scoreSource } from "../../research/verifier.js";
import type { SubagentReport, SubagentTask } from "../types.js";

export async function runSourceVerifierSubagent(task: SubagentTask): Promise<SubagentReport> {
  const input = (task.input ?? {}) as { claims?: string[]; sources?: Array<{ title?: string; url: string; snippet?: string }>; intent?: string };
  const sources = input.sources ?? [];
  return {
    taskId: task.id,
    kind: "source_verifier",
    status: "completed",
    title: "Source verification",
    summary: sources.length === 0 ? "No sources provided." : `Scored ${sources.length} provided source(s).`,
    findings:
      sources.length === 0
        ? [{ claim: "No sources provided.", confidence: 0, limitation: "Claims cannot be verified without sources." }]
        : sources.map((source) => ({
            claim: source.snippet || source.title || source.url,
            confidence: scoreSource({ title: source.title ?? source.url, url: source.url, snippet: source.snippet ?? "", sourceType: classifySource(source.url) }, input.intent),
            citations: [{ title: source.title ?? source.url, url: source.url }],
          })),
    recommendedMainAgentMessage: sources.length === 0 ? "No sources were provided for verification." : "Source verification is ready on screen.",
    safetyNotes: ["Unsupported claims should not be presented as verified."],
    createdAt: new Date().toISOString(),
  };
}
