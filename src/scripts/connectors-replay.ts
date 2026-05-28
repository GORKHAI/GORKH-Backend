import { config } from "../config.js";
import { validateGoogleCalendarScopes, GOOGLE_CALENDAR_EVENTS_READONLY_SCOPE } from "../connectors/oauth/google-scopes.js";
import { validateMcpInvocation } from "../connectors/mcp-adapter.js";

type Scenario =
  | "scope-registry"
  | "oauth-readiness"
  | "google-calendar-oauth-not-configured"
  | "google-calendar-scope-policy"
  | "token-vault"
  | "calendar-fixture-sync"
  | "calendar-daily-brief"
  | "calendar-write-blocked"
  | "calendar-fixture-import"
  | "gmail-fixture-import"
  | "daily-brief-from-fixtures"
  | "action-preview-blocked"
  | "mcp-security";

const scenario = (process.argv[2] ?? "scope-registry") as Scenario;
const allowed: Scenario[] = [
  "scope-registry",
  "oauth-readiness",
  "google-calendar-oauth-not-configured",
  "google-calendar-scope-policy",
  "token-vault",
  "calendar-fixture-sync",
  "calendar-daily-brief",
  "calendar-write-blocked",
  "calendar-fixture-import",
  "gmail-fixture-import",
  "daily-brief-from-fixtures",
  "action-preview-blocked",
  "mcp-security",
];
if (!allowed.includes(scenario)) throw new Error(`unknown connectors replay "${scenario}"`);

const base = `http://${config.HOST === "0.0.0.0" ? "127.0.0.1" : config.HOST}:${config.PORT}`;
const dev = await postJson<{ user: { id: string; email: string }; token: string }>(`${base}/dev/users`, {
  email: `connectors-${scenario}@example.com`,
  displayName: "Connectors Replay",
});

if (scenario === "scope-registry") {
  const calendar = await getJson(`${base}/connectors/google_calendar`, dev.token);
  const gmail = await getJson(`${base}/connectors/google_gmail`, dev.token);
  console.log(`scope-registry: ${JSON.stringify({ calendar, gmail })}`);
  assertIncludes(JSON.stringify(calendar), "calendar.events.readonly");
  assertIncludes(JSON.stringify(gmail), "gmail.metadata");
}

if (scenario === "oauth-readiness" || scenario === "google-calendar-oauth-not-configured") {
  const start = await getJson(`${base}/connectors/oauth/google-calendar/start`, dev.token);
  const accounts = await getJson(`${base}/connectors/accounts`, dev.token);
  console.log(`${scenario}: ${JSON.stringify({ start, accounts })}`);
  if (!config.GOOGLE_OAUTH_ENABLED || !config.GOOGLE_CALENDAR_READONLY_ENABLED) assertIncludes(JSON.stringify(start), "oauth_not_configured");
  assertIncludes(JSON.stringify(accounts), "rawTokenStorageAllowed");
}

if (scenario === "google-calendar-scope-policy") {
  const allowedScope = validateGoogleCalendarScopes([GOOGLE_CALENDAR_EVENTS_READONLY_SCOPE]);
  const deniedScope = validateGoogleCalendarScopes(["https://www.googleapis.com/auth/calendar.events"]);
  console.log(`google-calendar-scope-policy: ${JSON.stringify({ allowedScope, deniedScope })}`);
  if (!allowedScope.ok) throw new Error("expected read-only calendar events scope to be allowed");
  if (deniedScope.ok) throw new Error("expected write calendar scope to be denied");
}

if (scenario === "token-vault") {
  const accounts = await getJson(`${base}/connectors/accounts`, dev.token);
  console.log(`token-vault: ${JSON.stringify(accounts)}`);
  assertIncludes(JSON.stringify(accounts), "rawTokenStorageAllowed");
  assertDoesNotInclude(JSON.stringify(accounts), "accessToken");
}

if (scenario === "calendar-fixture-import") {
  const imported = await importCalendarFixture(dev.token);
  console.log(`calendar-fixture-import: ${JSON.stringify(imported)}`);
  assertIncludes(JSON.stringify(imported), "calendar_event");
  assertDoesNotInclude(JSON.stringify(imported), "access_token");
}

if (scenario === "gmail-fixture-import") {
  const imported = await postJson(
    `${base}/connectors/accounts/import-fixture`,
    {
      provider: "google_gmail",
      accountEmail: "fixture@example.com",
      items: [{ id: "gmail-1", subject: "Bank documents requested", snippet: "Please send documents by Friday", from: "bank@example.com" }],
    },
    dev.token,
  );
  console.log(`gmail-fixture-import: ${JSON.stringify(imported)}`);
  assertIncludes(JSON.stringify(imported), "email_message");
  assertDoesNotInclude(JSON.stringify(imported), "access_token");
}

if (scenario === "calendar-fixture-sync") {
  const imported = await importCalendarFixture(dev.token);
  const preview = await postJson(`${base}/connectors/accounts/${imported.account.id}/sync-preview`, {}, dev.token);
  const events = await getJson(`${base}/connectors/google-calendar/events`, dev.token);
  console.log(`calendar-fixture-sync: ${JSON.stringify({ preview, events })}`);
  assertIncludes(JSON.stringify(preview), "calendar_event");
  assertDoesNotInclude(JSON.stringify(events), "access_token");
}

if (scenario === "daily-brief-from-fixtures" || scenario === "calendar-daily-brief") {
  await importCalendarFixture(dev.token);
  const brief = await postJson(`${base}/daily/brief/generate`, {}, dev.token);
  console.log(`${scenario}: ${JSON.stringify(brief)}`);
  assertIncludes(JSON.stringify(brief), "Bank meeting");
  assertIncludes(JSON.stringify(brief), "google_calendar");
}

if (scenario === "action-preview-blocked" || scenario === "calendar-write-blocked") {
  const created = await postJson<{ proposal: { id: string } }>(
    `${base}/actions/proposals`,
    {
      sourceType: "manual",
      actionType: scenario === "calendar-write-blocked" ? "propose_calendar_event" : "draft_email",
      title: scenario === "calendar-write-blocked" ? "Propose meeting" : "Draft email",
      description: scenario === "calendar-write-blocked" ? "Proposal only; do not create calendar event." : "Draft only; do not send.",
      payload: scenario === "calendar-write-blocked" ? { title: "Bank meeting", startsAt: new Date(Date.now() + 86_400_000).toISOString() } : { to: "client@example.com", body: "Thanks." },
    },
    dev.token,
  );
  const preview = await postJson(`${base}/actions/proposals/${created.proposal.id}/preview`, {}, dev.token);
  console.log(`${scenario}: ${JSON.stringify(preview)}`);
  assertIncludes(JSON.stringify(preview), scenario === "calendar-write-blocked" ? "calendar_create_disabled_proposal_only" : "draft_only_no_send");
  assertIncludes(JSON.stringify(preview), "No external connector write");
}

if (scenario === "mcp-security") {
  const permissions = await getJson(`${base}/connectors/mcp_remote/permissions`, dev.token);
  let blocked = "";
  try {
    validateMcpInvocation({ connectorId: "mcp_remote", toolName: "bash", input: { apiKey: "redacted-test-value" } });
  } catch (err) {
    blocked = (err as Error).message;
  }
  console.log(`mcp-security: ${JSON.stringify({ permissions, blocked })}`);
  assertIncludes(JSON.stringify(permissions), "arbitrary_mcp_tool_invocation");
  assertIncludes(blocked, "disabled");
}

async function importCalendarFixture(token: string): Promise<{ account: { id: string }; items: unknown[] }> {
  return postJson<{ account: { id: string }; items: unknown[] }>(
    `${base}/connectors/accounts/import-fixture`,
    {
      provider: "google_calendar",
      accountEmail: "fixture@example.com",
      items: [{ id: "cal-1", title: "Bank meeting", description: "Discuss APR and repayment.", startsAt: new Date(Date.now() + 86_400_000).toISOString() }],
    },
    token,
  );
}

function assertIncludes(text: string, expected: string): void {
  if (!text.includes(expected)) throw new Error(`expected output to include ${expected}: ${text}`);
}

function assertDoesNotInclude(text: string, expected: string): void {
  if (text.includes(expected)) throw new Error(`expected output not to include ${expected}: ${text}`);
}

async function postJson<T>(url: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`POST ${url} failed: HTTP ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

async function getJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}
