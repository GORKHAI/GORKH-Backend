import { assert, fetchJson, liveConfig, printSummary, runCheck, waitFor } from "./live-verify-utils.js";

export interface RelayLiveVerifyConfig {
  apiUrl?: string;
  timeoutMs: number;
  useDevUsers: boolean;
  tokenA?: string;
  tokenB?: string;
  emailA: string;
  emailB: string;
  displayNameA: string;
  displayNameB: string;
}

type SafeRequest = {
  id: string;
  title: string;
  summary: string;
  status: string;
  direction?: string;
};

type SafeContact = {
  id: string;
  displayName: string;
  email?: string | null;
  status: string;
};

type SyncItem = {
  type: string;
  item?: {
    id?: string;
    requestId?: string;
    payload?: { requestId?: string; status?: string };
    status?: string;
  };
};

export function relayLiveConfigFromEnv(env: NodeJS.ProcessEnv = process.env): RelayLiveVerifyConfig {
  const base = liveConfig();
  const useDevUsers = env.LIVE_RELAY_USE_DEV_USERS === "true";
  return {
    apiUrl: cleanUrl(env.LIVE_API_URL) ?? base.apiUrl,
    timeoutMs: Number(env.LIVE_VERIFY_TIMEOUT_MS ?? base.timeoutMs),
    useDevUsers,
    tokenA: clean(env.LIVE_TEST_JWT_A),
    tokenB: clean(env.LIVE_TEST_JWT_B),
    emailA: clean(env.LIVE_RELAY_TEST_EMAIL_A) ?? clean(env.LIVE_TEST_EMAIL_A) ?? (useDevUsers ? `relay-live-a-${Date.now()}@gorkh.dev` : ""),
    emailB: clean(env.LIVE_RELAY_TEST_EMAIL_B) ?? clean(env.LIVE_TEST_EMAIL_B) ?? (useDevUsers ? `relay-live-b-${Date.now()}@gorkh.dev` : ""),
    displayNameA: clean(env.LIVE_RELAY_TEST_DISPLAY_NAME_A) ?? "Relay Live User A",
    displayNameB: clean(env.LIVE_RELAY_TEST_DISPLAY_NAME_B) ?? "Relay Live User B",
  };
}

export function validateRelayLiveConfig(cfg: RelayLiveVerifyConfig): string[] {
  const missing: string[] = [];
  if (!cfg.apiUrl) missing.push("LIVE_API_URL");
  if (!cfg.useDevUsers) {
    if (!cfg.tokenA) missing.push("LIVE_TEST_JWT_A");
    if (!cfg.tokenB) missing.push("LIVE_TEST_JWT_B");
    if (!cfg.emailB) missing.push("LIVE_RELAY_TEST_EMAIL_B or LIVE_TEST_EMAIL_B");
  }
  return missing;
}

export async function runRelayLiveVerify(cfg = relayLiveConfigFromEnv()) {
  const missing = validateRelayLiveConfig(cfg);
  if (missing.length > 0) {
    throw new Error(`missing_live_relay_test_credentials: ${missing.join(", ")}`);
  }

  const apiUrl = cfg.apiUrl!;
  const credentials = await getCredentials(apiUrl, cfg);
  const checks = [];

  checks.push(
    await runCheck("user A relay identity", async () => {
      const identity = await getOrCreateIdentity(apiUrl, credentials.tokenA);
      assert(Boolean(identity.identity?.id), "identity A missing id");
      return { relayEnabled: identity.identity?.relayEnabled !== false };
    }),
  );

  checks.push(
    await runCheck("user B relay identity", async () => {
      const identity = await getOrCreateIdentity(apiUrl, credentials.tokenB);
      assert(Boolean(identity.identity?.id), "identity B missing id");
      return { relayEnabled: identity.identity?.relayEnabled !== false };
    }),
  );

  let firstRequestId = "";
  checks.push(
    await runCheck("user A contact, draft, approve-send", async () => {
      const contact = await createContact(apiUrl, credentials.tokenA, cfg);
      const draft = await draftRequest(apiUrl, credentials.tokenA, contact.contact.id, "Ask whether next week works for an investor call.");
      const sent = await approveSend(apiUrl, credentials.tokenA, draft.request.id);
      firstRequestId = sent.request.id;
      assert(sent.externalEmailSent === false, "relay v0 must not send external email");
      assert(sent.request.status === "sent", `expected sent, got ${sent.request.status}`);
      return { requestId: sent.request.id, contactStatus: contact.contact.status, externalEmailSent: sent.externalEmailSent };
    }),
  );

  checks.push(
    await runCheck("user B inbox and mobile sync received", async () => {
      const inbox = await waitFor(async () => {
        const response = await listInbox(apiUrl, credentials.tokenB);
        return response.requests.find((request) => request.id === firstRequestId) ?? null;
      }, cfg.timeoutMs);
      const sync = await waitFor(async () => {
        const response = await mobileSync(apiUrl, credentials.tokenB);
        return hasRelaySyncItem(response.items, firstRequestId, "relay_request_received") ? response : null;
      }, cfg.timeoutMs);
      return { inboxStatus: inbox.status, relayItems: sync.items.filter((item) => item.type.startsWith("relay_")).length };
    }),
  );

  checks.push(
    await runCheck("user B approves request", async () => {
      const approved = await decide(apiUrl, credentials.tokenB, firstRequestId, "approve", { reply: "Yes, next Tuesday works." });
      assert(approved.request.status === "approved", `expected approved, got ${approved.request.status}`);
      const sync = await waitFor(async () => {
        const response = await mobileSync(apiUrl, credentials.tokenA);
        return hasRelaySyncItem(response.items, firstRequestId, "relay_request_updated") ? response : null;
      }, cfg.timeoutMs);
      return { status: approved.request.status, senderRelayUpdates: sync.items.filter((item) => item.type === "relay_request_updated").length };
    }),
  );

  checks.push(await runCheck("user B rejects separate request", () => runDecisionScenario(apiUrl, credentials.tokenA, credentials.tokenB, cfg, "reject")));
  checks.push(await runCheck("user B blocks sender on separate request", () => runDecisionScenario(apiUrl, credentials.tokenA, credentials.tokenB, cfg, "block")));

  checks.push(
    await runCheck("relay audit events exist", async () => {
      const [auditA, auditB] = await Promise.all([auditEvents(apiUrl, credentials.tokenA), auditEvents(apiUrl, credentials.tokenB)]);
      assert(auditA.auditEvents.length > 0, "sender audit events missing");
      assert(auditB.auditEvents.length > 0, "receiver audit events missing");
      return { senderEvents: auditA.auditEvents.length, receiverEvents: auditB.auditEvents.length };
    }),
  );

  printSummary("relay:live:verify", checks);
}

async function runDecisionScenario(
  apiUrl: string,
  tokenA: string,
  tokenB: string,
  cfg: RelayLiveVerifyConfig,
  decision: "reject" | "block",
) {
  const contact = await createContact(apiUrl, tokenA, cfg);
  const draft = await draftRequest(apiUrl, tokenA, contact.contact.id, decision === "block" ? "Ask whether Saturday works." : "Ask whether they want to review the brief.");
  const sent = await approveSend(apiUrl, tokenA, draft.request.id);
  assert(sent.externalEmailSent === false, "relay v0 must not send external email");
  await waitFor(async () => {
    const inbox = await listInbox(apiUrl, tokenB);
    return inbox.requests.find((request) => request.id === sent.request.id) ?? null;
  }, cfg.timeoutMs);
  const result = await decide(apiUrl, tokenB, sent.request.id, decision, undefined);
  assert(result.request.status === (decision === "block" ? "blocked" : "rejected"), `unexpected ${decision} status ${result.request.status}`);
  return { requestId: sent.request.id, status: result.request.status, externalEmailSent: sent.externalEmailSent };
}

async function getCredentials(apiUrl: string, cfg: RelayLiveVerifyConfig) {
  if (!cfg.useDevUsers) return { tokenA: cfg.tokenA!, tokenB: cfg.tokenB! };
  const [userA, userB] = await Promise.all([
    fetchJson<{ token: string }>(`${apiUrl}/dev/users`, {
      method: "POST",
      body: { email: cfg.emailA, displayName: cfg.displayNameA },
      timeoutMs: cfg.timeoutMs,
    }),
    fetchJson<{ token: string }>(`${apiUrl}/dev/users`, {
      method: "POST",
      body: { email: cfg.emailB, displayName: cfg.displayNameB },
      timeoutMs: cfg.timeoutMs,
    }),
  ]);
  assert(Boolean(userA.token && userB.token), "dev user tokens were not returned");
  return { tokenA: userA.token, tokenB: userB.token };
}

function getOrCreateIdentity(apiUrl: string, token: string) {
  return fetchJson<{ identity: { id: string; relayEnabled: boolean } }>(`${apiUrl}/relay/identity`, { token });
}

function createContact(apiUrl: string, token: string, cfg: RelayLiveVerifyConfig) {
  return fetchJson<{ contact: SafeContact }>(`${apiUrl}/relay/contacts`, {
    method: "POST",
    token,
    body: {
      displayName: cfg.displayNameB,
      email: cfg.emailB,
      relationship: "relay_live_test",
      trustLevel: "standard",
    },
  });
}

function draftRequest(apiUrl: string, token: string, contactId: string, goal: string) {
  return fetchJson<{ request: SafeRequest }>(`${apiUrl}/relay/requests/draft`, {
    method: "POST",
    token,
    body: {
      requestType: "meeting_request",
      recipient: { contactId },
      goal,
      context: { source: "relay_live_verify" },
      requestedShare: {},
    },
  });
}

function approveSend(apiUrl: string, token: string, requestId: string) {
  return fetchJson<{ request: SafeRequest; externalEmailSent: boolean }>(`${apiUrl}/relay/requests/${requestId}/approve-send`, { method: "POST", token });
}

function listInbox(apiUrl: string, token: string) {
  return fetchJson<{ requests: SafeRequest[] }>(`${apiUrl}/relay/requests/inbox`, { token });
}

function decide(apiUrl: string, token: string, requestId: string, decision: "approve" | "reject" | "block", approvedPayload?: Record<string, unknown>) {
  const body = decision === "approve" ? { approvedPayload } : { reason: `relay live ${decision}` };
  const path = decision === "block" ? "block-sender" : decision;
  return fetchJson<{ request: SafeRequest }>(`${apiUrl}/relay/requests/${requestId}/${path}`, { method: "POST", token, body });
}

function mobileSync(apiUrl: string, token: string) {
  return fetchJson<{ items: SyncItem[] }>(`${apiUrl}/mobile/sync`, { token });
}

function auditEvents(apiUrl: string, token: string) {
  return fetchJson<{ auditEvents: unknown[] }>(`${apiUrl}/relay/audit-events`, { token });
}

function hasRelaySyncItem(items: SyncItem[], requestId: string, type: string): boolean {
  return items.some((item) => item.type === type && (item.item?.id === requestId || item.item?.requestId === requestId || item.item?.payload?.requestId === requestId));
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function cleanUrl(value: string | undefined): string | undefined {
  const trimmed = clean(value);
  return trimmed?.replace(/\/+$/g, "");
}

if (process.argv[1]?.endsWith("relay-live-verify.ts") || process.argv[1]?.endsWith("relay-live-verify.js")) {
  runRelayLiveVerify().catch((err) => {
    console.error((err as Error).message);
    process.exit(1);
  });
}
