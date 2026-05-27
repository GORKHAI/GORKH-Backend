import { z } from "zod";

export const connectorIdSchema = z.enum(["google_gmail", "google_calendar", "microsoft_outlook", "notion", "slack", "todoist", "github", "mcp_remote"]);

export const connectorPermissionSchema = z.enum([
  "read_email_headers",
  "read_email_body",
  "draft_email",
  "send_email_requires_approval",
  "read_calendar",
  "propose_calendar_event",
  "create_calendar_event_requires_approval",
  "read_documents",
  "write_documents_requires_approval",
  "read_tasks",
  "create_task_requires_approval",
  "mcp_tool_invoke_requires_manifest",
  "mcp_network_disabled_by_default",
  "oauth_readonly_scope",
  "token_ref_required",
]);

export type ConnectorId = z.infer<typeof connectorIdSchema>;
export type ConnectorPermission = z.infer<typeof connectorPermissionSchema>;

export interface ConnectorManifest {
  id: ConnectorId;
  name: string;
  category: "email" | "calendar" | "documents" | "messaging" | "tasks" | "code" | "mcp";
  enabled: boolean;
  configured: boolean;
  authType: "oauth_placeholder" | "none";
  permissions: ConnectorPermission[];
  disabledReason: string;
  riskLevel: "low" | "medium" | "high";
}

export class ConnectorPolicyError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
