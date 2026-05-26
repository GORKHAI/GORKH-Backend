export type ToolPermission =
  | "read_public_web"
  | "read_user_profile"
  | "propose_profile_fact"
  | "confirm_profile_fact"
  | "read_user_memory"
  | "write_memory"
  | "send_external_message"
  | "submit_form"
  | "execute_code"
  | "access_private_browser_session"
  | "store_sensitive_profile_fact";

export interface ToolManifest {
  name: string;
  version: string;
  description: string;
  category: string;
  riskLevel: "low" | "medium" | "high" | "blocked";
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  permissions: ToolPermission[];
  enabled: boolean;
}
