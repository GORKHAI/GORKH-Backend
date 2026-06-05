import { assert, fetchJson, liveConfig, printSummary, runCheck, waitFor, type CheckResult } from "./live-verify-utils.js";

export interface RelayLiveVerifyConfig {
  apiUrl?: string;
  gatewayUrl?: string;
  apiWsUrl?: string;
  gatewayWsUrl?: string;
  timeoutMs: number;
  useDevUsers: boolean;
  opsAdminToken?: string;
  tokenA?: string;
  tokenB?: string;
  emailA: string;
  emailB: string;
  displayNameA: string;
  displayNameB: string;
  renderApiServiceId?: string;
  renderGatewayServiceId?: string;
  renderWorkerServiceId?: string;
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

type Credentials = {
  tokenA: string;
  tokenB: string;
  source: "jwt" | "ops_test_user" | "dev_user";
};

type RelayLiveSummary = {
  apiLive: boolean;
  gatewayLive: boolean;
  userAIdentity: boolean;
  userBIdentity: boolean;
  contactCreated: boolean;
  requestDrafted: boolean;
  senderApproved: boolean;
  receiverInbox: boolean;
  receiverApproved: boolean;
  receiverRejected: boolean;
  receiverIgnored: boolean;
  receiverBlocked: boolean;
  blockPreventsFollowUp: boolean;
  mobileSync: boolean;
  auditEvents: boolean;
  externalSendExecuted: boolean;
  privacyLeakDetected: boolean;
  rawTokenPrinted: boolean;
  credentialSource?: Credentials["source"];
  status: "pending" | "passed" | "failed";
};

const relayForbiddenPrivateMarkers = [
  "accessToken",
  "refreshToken",
  "providerKey",
  "apiSecret",
  "calendarEvents",
  "gmail",
  "emailThread",
  "privateMemory",
  "profileFacts",
  "rawUserId",
];

export function relayLiveConfigFromEnv(env: NodeJS.ProcessEnv = process.env): RelayLiveVerifyConfig {
  const base = liveConfig();
  const useDevUsers = env.LIVE_RELAY_USE_DEV_USERS === "true";
  const opsAdminToken = clean(env.OPS_CONSOLE_ADMIN_TOKEN);
  const hasJwtPair = Boolean(clean(env.LIVE_TEST_JWT_A) && clean(env.LIVE_TEST_JWT_B));
  const canMintUsers = useDevUsers || Boolean(opsAdminToken && !hasJwtPair);
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  return {
    apiUrl: cleanUrl(env.LIVE_API_URL) ?? base.apiUrl,
    gatewayUrl: cleanUrl(env.LIVE_GATEWAY_URL) ?? base.gatewayUrl,
    apiWsUrl: cleanUrl(env.LIVE_API_WS_URL) ?? base.apiWsUrl,
    gatewayWsUrl: cleanUrl(env.LIVE_GATEWAY_WS_URL) ?? base.gatewayWsUrl,
    timeoutMs: Number(env.LIVE_VERIFY_TIMEOUT_MS ?? base.timeoutMs),
    useDevUsers,
    opsAdminToken,
    tokenA: clean(env.LIVE_TEST_JWT_A),
    tokenB: clean(env.LIVE_TEST_JWT_B),
    emailA: clean(env.LIVE_RELAY_TEST_EMAIL_A) ?? (canMintUsers ? `relay-live-a-${stamp}@gorkh.dev` : ""),
    emailB: clean(env.LIVE_RELAY_TEST_EMAIL_B) ?? clean(env.LIVE_TEST_EMAIL_B) ?? (canMintUsers ? `relay-live-b-${stamp}@gorkh.dev` : ""),
    displayNameA: clean(env.LIVE_RELAY_TEST_DISPLAY_NAME_A) ?? "Relay Sender",
    displayNameB: clean(env.LIVE_RELAY_TEST_DISPLAY_NAME_B) ?? "Relay Receiver",
    renderApiServiceId: clean(env.RENDER_API_SERVICE_ID),
    renderGatewayServiceId: clean(env.RENDER_GATEWAY_SERVICE_ID),
    renderWorkerServiceId: clean(env.RENDER_WORKER_SERVICE_ID),
  };
}

export function validateRelayLiveConfig(cfg: RelayLiveVerifyConfig): string[] {
  const missing: string[] = [];
  if (!cfg.apiUrl) missing.push("LIVE_API_URL");
  if (!cfg.gatewayUrl) missing.push("LIVE_GATEWAY_URL");

  const hasJwtPair = Boolean(cfg.tokenA && cfg.tokenB);
  const hasCredentialSource = hasJwtPair || Boolean(cfg.opsAdminToken) || cfg.useDevUsers;
  if (!hasCredentialSource) {
    if (!cfg.tokenA) missing.push("LIVE_TEST_JWT_A");
    if (!cfg.tokenB) missing.push("LIVE_TEST_JWT_B");
    missing.push("OPS_CONSOLE_ADMIN_TOKEN");
  } else if (!hasJwtPair && !cfg.useDevUsers && !cfg.opsAdminToken) {
    missing.push("OPS_CONSOLE_ADMIN_TOKEN");
  }

  if (hasJwtPair && !cfg.emailB) missing.push("LIVE_RELAY_TEST_EMAIL_B or LIVE_TEST_EMAIL_B");
  return missing;
}

export function redactRelayLiveOutput(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/token=[A-Za-z0-9._-]+/g, "token=[redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-jwt]")
    .replace(/OPS_CONSOLE_ADMIN_TOKEN=([^\s]+)/g, "OPS_CONSOLE_ADMIN_TOKEN=[redacted]");
}

export function emptyRelayLiveSummary(): RelayLiveSummary {
  return {
    apiLive: false,
    gatewayLive: false,
    userAIdentity: false,
    userBIdentity: false,
    contactCreated: false,
    requestDrafted: false,
    senderApproved: false,
    receiverInbox: false,
    receiverApproved: false,
    receiverRejected: false,
    receiverIgnored: false,
    receiverBlocked: false,
    blockPreventsFollowUp: false,
    mobileSync: false,
    auditEvents: false,
    externalSendExecuted: false,
    privacyLeakDetected: false,
    rawTokenPrinted: false,
    status: "pending",
  };
}

export async function runRelayLiveVerify(cfg = relayLiveConfigFromEnv()) {
  const missing = validateRelayLiveConfig(cfg);
  if (missing.length > 0) {
    throw new Error(`missing_live_relay_test_credentials: ${missing.join(", ")}`);
  }

  const apiUrl = cfg.apiUrl!;
  const gatewayUrl = cfg.gatewayUrl!;
  const summary = emptyRelayLiveSummary();
  const checks: CheckResult[] = [];

  checks.push(
    await runCheck("api health and ready", async () => {
      const [health, ready] = await Promise.all([
        fetchJson<Record<string, unknown>>(`${apiUrl}/health`, { timeoutMs: cfg.timeoutMs }),
        fetchJson<Record<string, unknown>>(`${apiUrl}/health/ready`, { timeoutMs: cfg.timeoutMs }),
      ]);
      assert(Boolean(health), "API /health did not return JSON");
      assert(Boolean(ready), "API /health/ready did not return JSON");
      summary.apiLive = true;
      return { healthOk: true, readyOk: true };
    }),
  );

  checks.push(
    await runCheck("api dev users not publicly exposed", async () => {
      if (cfg.useDevUsers) return { skipped: "LIVE_RELAY_USE_DEV_USERS=true" };
      const status = await fetchStatus(`${apiUrl}/dev/users`, {
        method: "POST",
        body: { email: `relay-live-dev-protection-${Date.now()}@gorkh.dev`, displayName: "Relay Dev Protection" },
        timeoutMs: cfg.timeoutMs,
      });
      assert([401, 404, 405].includes(status), `/dev/users unexpectedly returned ${status}`);
      return { status };
    }),
  );

  checks.push(
    await runCheck("gateway health and providers", async () => {
      const [health, providers] = await Promise.all([
        fetchJson<Record<string, unknown>>(`${gatewayUrl}/health`, { timeoutMs: cfg.timeoutMs }),
        fetchJson<Record<string, unknown>>(`${gatewayUrl}/providers`, { timeoutMs: cfg.timeoutMs }),
      ]);
      assert(Boolean(health), "gateway /health did not return JSON");
      assert(Boolean(providers), "gateway /providers did not return JSON");
      summary.gatewayLive = true;
      return { healthOk: true, providersOk: true };
    }),
  );

  const credentials = await getCredentials(apiUrl, cfg);
  summary.credentialSource = credentials.source;

  checks.push(
    await runCheck("user A relay identity", async () => {
      const identity = await getOrCreateIdentity(apiUrl, credentials.tokenA);
      assert(Boolean(identity.identity?.id), "identity A missing id");
      summary.userAIdentity = true;
      return { relayEnabled: identity.identity?.relayEnabled !== false };
    }),
  );

  checks.push(
    await runCheck("user B relay identity", async () => {
      const identity = await getOrCreateIdentity(apiUrl, credentials.tokenB);
      assert(Boolean(identity.identity?.id), "identity B missing id");
      summary.userBIdentity = true;
      return { relayEnabled: identity.identity?.relayEnabled !== false };
    }),
  );

  let trustedContactId = "";
  checks.push(
    await runCheck("user A creates trusted contact for user B", async () => {
      const contact = await createContact(apiUrl, credentials.tokenA, cfg);
      const trusted = await trustContact(apiUrl, credentials.tokenA, contact.contact.id);
      trustedContactId = trusted.contact.id;
      summary.contactCreated = true;
      return { contactId: trusted.contact.id, status: trusted.contact.status };
    }),
  );

  let firstRequestId = "";
  checks.push(
    await runCheck("user A drafts and approves send", async () => {
      const draft = await draftRequest(apiUrl, credentials.tokenA, trustedContactId, "Ask whether the receiver is available for an investor call next week.");
      assert(draft.request.status === "pending_sender_approval", `expected pending_sender_approval, got ${draft.request.status}`);
      assert(!containsPrivateLeak(draft), "draft response contained private markers");
      summary.requestDrafted = true;
      const sent = await approveSend(apiUrl, credentials.tokenA, draft.request.id);
      firstRequestId = sent.request.id;
      assert(sent.externalEmailSent === false, "relay v0 must not send external email");
      assert(sent.request.status === "sent", `expected sent, got ${sent.request.status}`);
      summary.senderApproved = true;
      return {
        requestId: sent.request.id,
        title: sent.request.title,
        status: sent.request.status,
        externalEmailSent: sent.externalEmailSent,
      };
    }),
  );

  checks.push(
    await runCheck("user B inbox and mobile sync received", async () => {
      const inbox = await waitFor(async () => {
        const response = await listInbox(apiUrl, credentials.tokenB);
        assert(!containsPrivateLeak(response), "inbox response contained private markers");
        return response.requests.find((request) => request.id === firstRequestId) ?? null;
      }, cfg.timeoutMs);
      const sync = await waitFor(async () => {
        const response = await mobileSync(apiUrl, credentials.tokenB);
        assert(!containsPrivateLeak(response), "mobile sync response contained private markers");
        return hasRelaySyncItem(response.items, firstRequestId, "relay_request_received") || hasRelaySyncItem(response.items, firstRequestId, "relay_approval_needed") ? response : null;
      }, cfg.timeoutMs);
      summary.receiverInbox = true;
      summary.mobileSync = true;
      return { inboxStatus: inbox.status, relayItems: sync.items.filter((item) => item.type.startsWith("relay_")).length };
    }),
  );

  checks.push(
    await runCheck("user B approves request with limited payload", async () => {
      const approved = await decide(apiUrl, credentials.tokenB, firstRequestId, "approve", {
        availability: "Yes, next Tuesday works.",
        shareScope: "text_only",
      });
      assert(approved.request.status === "approved", `expected approved, got ${approved.request.status}`);
      const sync = await waitFor(async () => {
        const response = await mobileSync(apiUrl, credentials.tokenA);
        return hasRelaySyncItem(response.items, firstRequestId, "relay_request_updated") ? response : null;
      }, cfg.timeoutMs);
      summary.receiverApproved = true;
      summary.mobileSync = true;
      return { status: approved.request.status, senderRelayUpdates: sync.items.filter((item) => item.type === "relay_request_updated").length };
    }),
  );

  checks.push(await runCheck("user B rejects separate request", () => runDecisionScenario(apiUrl, credentials.tokenA, credentials.tokenB, cfg, "reject", summary)));
  checks.push(await runCheck("user B ignores separate request", () => runDecisionScenario(apiUrl, credentials.tokenA, credentials.tokenB, cfg, "ignore", summary)));
  checks.push(await runCheck("user B blocks sender and follow-up is blocked", () => runDecisionScenario(apiUrl, credentials.tokenA, credentials.tokenB, cfg, "block", summary)));

  checks.push(
    await runCheck("relay audit events exist", async () => {
      const [auditA, auditB] = await Promise.all([auditEvents(apiUrl, credentials.tokenA), auditEvents(apiUrl, credentials.tokenB)]);
      const auditText = JSON.stringify({ auditA, auditB });
      assert(auditA.auditEvents.length > 0, "sender audit events missing");
      assert(auditB.auditEvents.length > 0, "receiver audit events missing");
      assert(auditText.includes("relay_request_drafted"), "draft audit missing");
      assert(auditText.includes("relay_request_sent"), "approve-send audit missing");
      assert(auditText.includes("relay_request_approved"), "receiver approval audit missing");
      summary.auditEvents = true;
      return { senderEvents: auditA.auditEvents.length, receiverEvents: auditB.auditEvents.length };
    }),
  );

  checks.push(
    await runCheck("final live summary", async () => {
      summary.privacyLeakDetected = checks.some((check) => check.error?.includes("private markers")) || summary.privacyLeakDetected;
      summary.rawTokenPrinted = false;
      summary.status = checks.every((check) => check.ok) && !summary.externalSendExecuted && !summary.privacyLeakDetected ? "passed" : "failed";
      return summary;
    }),
  );

  printSummary("relay:live:verify", checks);
}

async function runDecisionScenario(
  apiUrl: string,
  tokenA: string,
  tokenB: string,
  cfg: RelayLiveVerifyConfig,
  decision: "reject" | "ignore" | "block",
  summary: RelayLiveSummary,
) {
  const contact = await createContact(apiUrl, tokenA, cfg);
  const trusted = await trustContact(apiUrl, tokenA, contact.contact.id);
  const draft = await draftRequest(
    apiUrl,
    tokenA,
    trusted.contact.id,
    decision === "block" ? "Ask whether Saturday works." : decision === "ignore" ? "Ask whether a quick intro is appropriate." : "Ask whether they want to review the brief.",
  );
  const sent = await approveSend(apiUrl, tokenA, draft.request.id);
  assert(sent.externalEmailSent === false, "relay v0 must not send external email");
  await waitFor(async () => {
    const inbox = await listInbox(apiUrl, tokenB);
    return inbox.requests.find((request) => request.id === sent.request.id) ?? null;
  }, cfg.timeoutMs);
  const result = await decide(apiUrl, tokenB, sent.request.id, decision, undefined);
  const expected = decision === "block" ? "blocked" : decision === "ignore" ? "ignored" : "rejected";
  assert(result.request.status === expected, `unexpected ${decision} status ${result.request.status}`);
  if (decision === "reject") summary.receiverRejected = true;
  if (decision === "ignore") summary.receiverIgnored = true;
  if (decision === "block") {
    summary.receiverBlocked = true;
    const followUp = await draftRequest(apiUrl, tokenA, trusted.contact.id, "Ask one follow-up after the block.");
    const blocked = await expectApproveSendBlocked(apiUrl, tokenA, followUp.request.id);
    assert(blocked, "block did not prevent a follow-up request");
    summary.blockPreventsFollowUp = true;
  }
  return { requestId: sent.request.id, status: result.request.status, externalEmailSent: sent.externalEmailSent };
}

async function getCredentials(apiUrl: string, cfg: RelayLiveVerifyConfig): Promise<Credentials> {
  if (cfg.tokenA && cfg.tokenB) return { tokenA: cfg.tokenA, tokenB: cfg.tokenB, source: "jwt" };
  if (cfg.opsAdminToken) {
    const [userA, userB] = await Promise.all([
      createOpsTestUser(apiUrl, cfg.opsAdminToken, cfg.emailA, cfg.displayNameA, cfg.timeoutMs),
      createOpsTestUser(apiUrl, cfg.opsAdminToken, cfg.emailB, cfg.displayNameB, cfg.timeoutMs),
    ]);
    return { tokenA: userA.token, tokenB: userB.token, source: "ops_test_user" };
  }
  if (cfg.useDevUsers) {
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
    return { tokenA: userA.token, tokenB: userB.token, source: "dev_user" };
  }
  throw new Error("missing_live_relay_test_credentials");
}

function createOpsTestUser(apiUrl: string, opsToken: string, email: string, displayName: string, timeoutMs: number) {
  return fetchJson<{ token: string }>(`${apiUrl}/ops/test-user`, {
    method: "POST",
    token: opsToken,
    body: { email, displayName },
    timeoutMs,
  });
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

function trustContact(apiUrl: string, token: string, contactId: string) {
  return fetchJson<{ contact: SafeContact }>(`${apiUrl}/relay/contacts/${contactId}/trust`, { method: "POST", token });
}

function draftRequest(apiUrl: string, token: string, contactId: string, goal: string) {
  return fetchJson<{ request: SafeRequest }>(`${apiUrl}/relay/requests/draft`, {
    method: "POST",
    token,
    body: {
      requestType: "meeting_request",
      recipient: { contactId },
      goal,
      context: { source: "relay_live_verify", note: "Text-only Relay live verification. No external send is performed." },
      requestedShare: {},
    },
  });
}

function approveSend(apiUrl: string, token: string, requestId: string) {
  return fetchJson<{ request: SafeRequest; externalEmailSent: boolean }>(`${apiUrl}/relay/requests/${requestId}/approve-send`, { method: "POST", token });
}

async function expectApproveSendBlocked(apiUrl: string, token: string, requestId: string): Promise<boolean> {
  try {
    await approveSend(apiUrl, token, requestId);
    return false;
  } catch (err) {
    return (err as Error).message.includes("blocked");
  }
}

function listInbox(apiUrl: string, token: string) {
  return fetchJson<{ requests: SafeRequest[] }>(`${apiUrl}/relay/requests/inbox`, { token });
}

function decide(apiUrl: string, token: string, requestId: string, decision: "approve" | "reject" | "ignore" | "block", approvedPayload?: Record<string, unknown>) {
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

async function fetchStatus(url: string, options: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<number> {
  const response = await fetch(url, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(options.timeoutMs ?? liveConfig().timeoutMs),
  });
  await response.arrayBuffer();
  return response.status;
}

function containsPrivateLeak(value: unknown): boolean {
  const text = JSON.stringify(value);
  return relayForbiddenPrivateMarkers.some((marker) => text.includes(marker));
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
    console.error(redactRelayLiveOutput((err as Error).message));
    process.exit(1);
  });
}
