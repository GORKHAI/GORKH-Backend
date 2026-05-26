import { config } from "../config.js";

export function retryDelayMs(attemptNumber: number): number {
  const exponent = Math.max(0, attemptNumber - 1);
  const delay = config.SUBAGENT_RETRY_BASE_MS * 2 ** exponent;
  return Math.min(delay, config.SUBAGENT_RETRY_MAX_MS);
}

export function isNonRetryableErrorCode(code: string | null | undefined): boolean {
  return [
    "provider_not_configured",
    "policy_denied",
    "dangerous_permission_denied",
    "research_not_allowed",
    "session_not_active",
    "canceled",
    "suppressed",
  ].includes(code ?? "");
}
