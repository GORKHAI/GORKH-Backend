export const stableErrorCodes = [
  "auth_missing",
  "auth_invalid",
  "consent_required",
  "unsupported_protocol_version",
  "provider_not_configured",
  "deepgram_not_configured",
  "llm_not_configured",
  "research_provider_not_configured",
  "token_vault_not_configured",
  "connector_not_connected",
  "connector_not_configured",
  "external_write_disabled",
  "profile_mutation_not_allowed",
  "budget_exceeded",
  "rate_limited",
  "session_not_found",
  "session_interrupted",
  "session_discarded",
  "invalid_message",
  "internal_error",
] as const;

export type StableErrorCode = (typeof stableErrorCodes)[number];

export interface MobileErrorShape {
  code: StableErrorCode;
  message: string;
  retryable: boolean;
  details: Record<string, unknown>;
}

export function mobileError(code: StableErrorCode, message: string, options: { retryable?: boolean; details?: Record<string, unknown> } = {}): MobileErrorShape {
  return {
    code,
    message,
    retryable: options.retryable ?? false,
    details: options.details ?? {},
  };
}

export function isStableErrorCode(value: string): value is StableErrorCode {
  return (stableErrorCodes as readonly string[]).includes(value);
}
