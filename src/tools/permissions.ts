import { config } from "../config.js";
import type { ToolManifest, ToolPermission } from "./types.js";

const denied: ToolPermission[] = ["send_external_message", "submit_form", "execute_code", "access_private_browser_session"];
const requiresApproval: ToolPermission[] = ["confirm_profile_fact", "write_memory", "store_sensitive_profile_fact"];

export function decideToolPermission(manifest: ToolManifest): "allowed" | "denied" | "requires_user_approval" {
  if (config.TOOL_EXECUTION_MODE === "disabled") return "denied";
  if (!manifest.enabled || manifest.riskLevel === "blocked") return "denied";
  if (manifest.permissions.some((permission) => denied.includes(permission))) return "denied";
  if (manifest.permissions.some((permission) => requiresApproval.includes(permission))) return "requires_user_approval";
  return "allowed";
}

export function permissionModel() {
  return {
    mode: config.TOOL_EXECUTION_MODE,
    allowed: ["read_public_web", "read_user_profile", "propose_profile_fact", "read_user_memory"],
    requiresUserApproval: requiresApproval,
    disabled: denied,
    dangerousCapabilitiesDisabled: [
      "arbitrary shell execution",
      "private browser session access",
      "form submission",
      "purchases/payments",
      "external message sending without approval",
    ],
  };
}
