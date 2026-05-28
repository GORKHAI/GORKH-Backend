import { config } from "../config.js";
import { googleCalendarReadiness } from "../connectors/google-calendar/sync.js";

const scenario = process.argv[2] ?? "google-calendar-readonly";
const allowed = new Set(["google-calendar-readonly", "google-calendar-sync-preview", "google-calendar-daily-brief"]);
if (!allowed.has(scenario)) throw new Error(`unknown connectors live scenario "${scenario}"`);

const readiness = googleCalendarReadiness();
if (!readiness.enabled) {
  console.log(
    JSON.stringify({
      scenario,
      status: "skipped",
      code: "oauth_not_configured",
      missing: readiness.missing,
      fakeDataGenerated: false,
      tokenPrinted: false,
    }),
  );
  process.exit(0);
}

console.log(
  JSON.stringify({
    scenario,
    status: "manual_oauth_required",
    provider: "google_calendar",
    readOnly: true,
    scopes: readiness.scopes,
    message: "Google OAuth env is configured. Complete browser OAuth, then use Brain Console sync preview/sync. This script does not fabricate an account or event.",
    redirectUriConfigured: Boolean(config.GOOGLE_OAUTH_REDIRECT_URI || config.GOOGLE_OAUTH_REDIRECT_BASE_URL),
    tokenPrinted: false,
  }),
);
