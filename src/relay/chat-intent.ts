import type { AgentRequestType } from "../db/schema.js";

export function detectRelayIntent(text: string): null | {
  requestType: AgentRequestType;
  recipient: { email?: string; displayName?: string };
  goal: string;
  teamOrBroadcast: boolean;
} {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const lower = trimmed.toLowerCase();
  if (!/\b(ask|send a request to|ask .*agent|ask candidate|ask investor)\b/i.test(trimmed)) return null;

  const email = trimmed.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0].toLowerCase();
  const teamOrBroadcast = /\b(my team|team agents|all investors|everyone|all contacts|broadcast)\b/i.test(trimmed);
  const requestType = classifyRequestType(lower);
  const displayName = inferDisplayName(trimmed, email);
  const goal = inferGoal(trimmed);
  return { requestType, recipient: { email, displayName }, goal, teamOrBroadcast };
}

function classifyRequestType(lower: string): AgentRequestType {
  if (lower.includes("meeting") || lower.includes("call")) return "meeting_request";
  if (lower.includes("deck") || lower.includes("investor if they want")) return "investor_interest_check";
  if (lower.includes("candidate") || lower.includes("role") || lower.includes("job")) return "job_opportunity";
  if (lower.includes("available") || lower.includes("works") || lower.includes("saturday")) return "availability_request";
  if (lower.includes("blocker") || lower.includes("team")) return "team_update_request";
  return "general_request";
}

function inferDisplayName(text: string, email?: string) {
  const withoutEmail = email ? text.replace(email, "") : text;
  const patterns = [
    /\bask\s+([^,]+?)'s\s+agent\b/i,
    /\bask\s+([^,]+?)\s+(?:if|whether|to)\b/i,
    /\bsend a request to\s+([^,]+?)\s+(?:if|whether|to|about)\b/i,
  ];
  for (const pattern of patterns) {
    const match = withoutEmail.match(pattern)?.[1]?.trim();
    if (match && !/\b(my team|team agents|investor|candidate)\b/i.test(match)) return cleanName(match);
    if (match && /\binvestor\b/i.test(match)) return "Investor";
    if (match && /\bcandidate\b/i.test(match)) return "Candidate";
  }
  if (/\binvestor\b/i.test(withoutEmail)) return "Investor";
  if (/\bcandidate\b/i.test(withoutEmail)) return "Candidate";
  return undefined;
}

function inferGoal(text: string) {
  const match = text.match(/\b(?:if|whether|to)\s+(.+)$/i)?.[1]?.trim();
  if (!match) return text;
  return match.endsWith(".") ? match : `${match}.`;
}

function cleanName(value: string) {
  return value.replace(/\b(agent|NearMind|this)\b/gi, "").replace(/\s+/g, " ").trim();
}
