export const GOOGLE_CALENDAR_EVENTS_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";
export const GOOGLE_CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

const V0_ALLOWED = new Set([GOOGLE_CALENDAR_EVENTS_READONLY_SCOPE]);
const OPTIONAL_READONLY = new Set([GOOGLE_CALENDAR_READONLY_SCOPE]);

export function validateGoogleCalendarScopes(scopes: string[]): { ok: boolean; allowed: string[]; denied: string[]; optionalReadonly: string[] } {
  const allowed: string[] = [];
  const optionalReadonly: string[] = [];
  const denied: string[] = [];
  for (const scope of scopes) {
    if (V0_ALLOWED.has(scope)) allowed.push(scope);
    else if (OPTIONAL_READONLY.has(scope)) optionalReadonly.push(scope);
    else denied.push(scope);
  }
  return { ok: denied.length === 0 && allowed.length > 0, allowed, denied, optionalReadonly };
}

export function assertGoogleCalendarScopes(scopes: string[]): string[] {
  const result = validateGoogleCalendarScopes(scopes);
  if (!result.ok) {
    throw new Error(`forbidden_google_calendar_scope:${result.denied.join(",") || "missing_readonly_scope"}`);
  }
  return result.allowed;
}
