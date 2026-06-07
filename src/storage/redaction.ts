const secretKeys = /token|secret|password|authorization|credential|api[_-]?key|oauth|encryptedPayload/i;

export function redactForUserExport(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactForUserExport);
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (secretKeys.test(key)) {
      result[key] = "[redacted]";
    } else {
      result[key] = redactForUserExport(nested);
    }
  }
  return result;
}

