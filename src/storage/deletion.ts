import { auditAccountEvent } from "../auth/account.js";
import { auditStorageEvent } from "./lifecycle.js";

export async function requestStorageDeletion(userId: string, reason?: string | null) {
  await auditAccountEvent(userId, "storage_delete_all_requested", { reason: reason ?? null, mode: "request" });
  await auditStorageEvent({ userId, eventType: "delete_all_requested", payload: { reason: reason ?? null, destructiveDeleteExecuted: false } });
  return {
    status: "requested" as const,
    message: "Your storage deletion request has been recorded. Full account deletion is handled by the account deletion workflow.",
    destructiveDeleteExecuted: false,
  };
}

