import { config } from "../config.js";
import type { ProfileFactDraft } from "./types.js";
import { canAutoConfirmFact, classifyProfileSensitivity } from "./privacy.js";

export function extractProfileFactsFromText(input: {
  text: string;
  stressSupportOptIn?: boolean;
  repeatedContext?: string[];
  sourceSessionId?: string | null;
}): ProfileFactDraft[] {
  const drafts: ProfileFactDraft[] = [];
  const text = normalize(input.text);
  const stressSupportOptIn = input.stressSupportOptIn === true;

  for (const match of text.matchAll(/\b(?:i am|i'm|i work as|my job is)\s+(?:a |an )?([^.!?\n]{3,80})/gi)) {
    const occupation = cleanup(match[1] ?? "");
    if (!occupation) continue;
    addDraft(drafts, {
      kind: "occupation",
      content: occupation,
      source: "explicit_user",
      confidence: 0.9,
      sensitivity: classifyProfileSensitivity(occupation),
      stressSupportOptIn,
      reason: "explicit self-described occupation",
    });
  }

  for (const match of text.matchAll(/\b(?:i build|i'm building|i am building|my project is|i work on)\s+([^.!?\n]{3,100})/gi)) {
    const project = cleanup(match[1] ?? "");
    if (!project) continue;
    addDraft(drafts, {
      kind: "project",
      content: project,
      source: "explicit_user",
      confidence: 0.85,
      sensitivity: classifyProfileSensitivity(project),
      stressSupportOptIn,
      reason: "explicit project statement",
    });
  }

  for (const match of text.matchAll(/\b(?:my goal is|i want to|i need to)\s+([^.!?\n]{3,120})/gi)) {
    const goal = cleanup(match[1] ?? "");
    if (!goal) continue;
    addDraft(drafts, {
      kind: "goal",
      content: goal,
      source: "explicit_user",
      confidence: 0.75,
      sensitivity: classifyProfileSensitivity(goal),
      stressSupportOptIn,
      reason: "explicit goal statement",
    });
  }

  for (const match of text.matchAll(/\b(?:i prefer|please keep|i like)\s+([^.!?\n]{3,100})/gi)) {
    const preference = cleanup(match[1] ?? "");
    if (!preference) continue;
    addDraft(drafts, {
      kind: /\b(short|concise|brief|direct)\b/i.test(preference) ? "communication_style" : "preference",
      content: preference,
      source: "explicit_user",
      confidence: 0.8,
      sensitivity: classifyProfileSensitivity(preference),
      stressSupportOptIn,
      reason: "explicit preference statement",
    });
  }

  if (/\b(i am stressed|i'm stressed|i feel anxious|i panic|i can't breathe|i cannot breathe|i'm overwhelmed|i am overwhelmed)\b/i.test(text)) {
    addDraft(drafts, {
      kind: "sensitive_candidate",
      content: "User self-reported stress or anxiety in a situation.",
      source: "explicit_user",
      confidence: 0.9,
      sensitivity: "sensitive",
      stressSupportOptIn,
      reason: "sensitive stress self-report",
    });
  }

  const repeated = `${text} ${(input.repeatedContext ?? []).join(" ")}`;
  if (/\b(solana|blockchain|smart contract|web3)\b/i.test(repeated)) {
    addDraft(drafts, {
      kind: "occupation",
      content: "Works with blockchain or web3 software",
      source: "inferred",
      confidence: 0.62,
      sensitivity: "low",
      stressSupportOptIn,
      reason: "repeated blockchain/web3 context",
    });
  }
  if (/\b(mobile app|ios|android|react native|swift|kotlin)\b/i.test(repeated)) {
    addDraft(drafts, {
      kind: "project",
      content: "Builds or discusses mobile app projects",
      source: "inferred",
      confidence: 0.6,
      sensitivity: "low",
      stressSupportOptIn,
      reason: "repeated mobile app context",
    });
  }

  return uniqueDrafts(drafts).slice(0, config.HUMAN_PROFILE_MAX_FACTS_PER_SESSION);
}

function addDraft(
  drafts: ProfileFactDraft[],
  args: Omit<ProfileFactDraft, "status"> & { stressSupportOptIn: boolean },
): void {
  const status = canAutoConfirmFact({
    source: args.source,
    sensitivity: args.sensitivity,
    stressSupportOptIn: args.stressSupportOptIn,
    autoSaveLowRisk: config.HUMAN_PROFILE_AUTO_SAVE_LOW_RISK,
    autoSaveSensitive: config.HUMAN_PROFILE_AUTO_SAVE_SENSITIVE,
  })
    ? "confirmed"
    : "proposed";
  drafts.push({
    kind: args.sensitivity === "sensitive" ? "sensitive_candidate" : args.kind,
    content: args.content,
    source: args.source,
    confidence: args.confidence,
    sensitivity: args.sensitivity,
    status,
    reason: args.reason,
  });
}

function uniqueDrafts(drafts: ProfileFactDraft[]): ProfileFactDraft[] {
  const seen = new Set<string>();
  return drafts.filter((draft) => {
    const key = `${draft.kind}:${draft.content.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function cleanup(value: string): string {
  return value.replace(/\b(and|but|so)\s*$/i, "").trim().replace(/^as\s+/i, "");
}
