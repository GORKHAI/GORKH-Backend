export type ReferenceKind = "hermes" | "openclaw" | "personaplex" | "unknown";
export type ReferenceEntryType = "directory" | "archive";

export interface ReferenceCandidate {
  path: string;
  type: ReferenceEntryType;
  kind: ReferenceKind;
  inspected: boolean;
  reason?: string;
}

const referenceMatchers: Array<[ReferenceKind, RegExp]> = [
  ["hermes", /hermes/i],
  ["openclaw", /open(?:c|cv)?law/i],
  ["personaplex", /personaplex/i],
];

export function classifyReferencePath(path: string): ReferenceKind {
  return referenceMatchers.find(([, pattern]) => pattern.test(path))?.[0] ?? "unknown";
}

export function classifyReferenceEntryType(path: string): ReferenceEntryType {
  return /\.(zip|tar|tar\.gz)$/i.test(path) ? "archive" : "directory";
}

export function buildReferenceInventory(paths: string[]): ReferenceCandidate[] {
  return paths
    .map((path) => ({
      path,
      type: classifyReferenceEntryType(path),
      kind: classifyReferencePath(path),
      inspected: false,
      reason: "discovered by safe file inventory",
    }))
    .filter((entry) => entry.kind !== "unknown")
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function renderReferenceInventoryMarkdown(candidates: ReferenceCandidate[]): string {
  const lines = ["# Local Reference Codebase Inventory", ""];
  if (candidates.length === 0) {
    lines.push("No local Hermes, OpenClaw, PersonaPlex, or matching archive files were detected. No local reference code inspection was claimed.");
    return `${lines.join("\n")}\n`;
  }
  lines.push("| Path | Kind | Type | Inspected | Notes |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const candidate of candidates) {
    lines.push(`| ${candidate.path} | ${candidate.kind} | ${candidate.type} | ${candidate.inspected ? "yes" : "no"} | ${candidate.reason ?? ""} |`);
  }
  return `${lines.join("\n")}\n`;
}
