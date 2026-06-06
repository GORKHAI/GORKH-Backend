export function authError(code: string, message: string, details: Record<string, unknown> = {}) {
  return {
    error: {
      code,
      message,
      retryable: false,
      details,
    },
  };
}

export function authDisabledError(feature: "apple" | "email") {
  if (feature === "apple") {
    return authError("apple_sign_in_not_enabled", "Sign in with Apple is not enabled for this alpha.", { configured: false });
  }
  return authError("email_auth_not_enabled", "Email sign-in is not enabled in this alpha.", { configured: false });
}
