import type { ToolManifest } from "./types.js";

export const builtinToolManifests: ToolManifest[] = [
  tool("web_search", "Public web search through configured provider", "research", "medium", ["read_public_web"], true),
  tool("web_fetch", "Fetch a public URL with SSRF protections", "research", "medium", ["read_public_web"], true),
  tool("research_answer", "Create a citation-backed research answer", "research", "medium", ["read_public_web"], true),
  tool("human_profile_read", "Read confirmed human profile context for the authenticated user", "profile", "low", ["read_user_profile"], true),
  tool("human_profile_propose_fact", "Propose a profile fact for user approval", "profile", "medium", ["propose_profile_fact"], true),
  tool("memory_lookup", "Look up existing user memories", "memory", "medium", ["read_user_memory"], true),
  tool("skill_list", "List user-approved workflow skills", "skill", "low", [], true),
  tool("skill_propose", "Propose a reusable workflow skill", "skill", "medium", [], true),
  tool("draft_followup", "Draft a follow-up message for user review only", "drafting", "medium", [], true),
  tool("send_external_message", "Disabled: would send external communication", "action", "blocked", ["send_external_message"], false),
  tool("submit_form", "Disabled: would submit forms", "action", "blocked", ["submit_form"], false),
  tool("execute_code", "Disabled: arbitrary shell/code execution is not allowed", "system", "blocked", ["execute_code"], false),
];

function tool(
  name: string,
  description: string,
  category: string,
  riskLevel: ToolManifest["riskLevel"],
  permissions: ToolManifest["permissions"],
  enabled: boolean,
): ToolManifest {
  return {
    name,
    version: "0.1.0",
    description,
    category,
    riskLevel,
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    permissions,
    enabled,
  };
}
