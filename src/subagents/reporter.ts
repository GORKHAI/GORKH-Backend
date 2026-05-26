import { config } from "../config.js";
import type { SubagentReport } from "./types.js";

export function trimSubagentReport(report: SubagentReport): SubagentReport {
  const max = config.SUBAGENT_REPORT_MAX_CHARS;
  return {
    ...report,
    summary: trim(report.summary, max),
    recommendedMainAgentMessage: report.recommendedMainAgentMessage ? trim(report.recommendedMainAgentMessage, 500) : undefined,
    findings: report.findings.slice(0, 8).map((finding) => ({
      ...finding,
      claim: trim(finding.claim, 500),
      citations: finding.citations?.slice(0, 6),
      confidence: Math.max(0, Math.min(1, finding.confidence)),
    })),
    safetyNotes: report.safetyNotes.slice(0, 8).map((note) => trim(note, 240)),
  };
}

function trim(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}…`;
}
