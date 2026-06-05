import { config } from "../config.js";
import { db } from "../db/client.js";
import { investorProfiles, outreachCampaigns } from "../db/schema.js";
import { readFile } from "node:fs/promises";

type Scenario =
  | "not-configured"
  | "create-room"
  | "guest-link"
  | "consent-required"
  | "transcript-ingest"
  | "summary"
  | "outreach-room"
  | "guest-permissions"
  | "livekit-token-shape"
  | "host-guest-token-flow"
  | "consent-token-gate"
  | "room-ui-static"
  | "no-secret-token-response";

const scenario = (process.argv[2] ?? "not-configured") as Scenario;
const allowed: Scenario[] = [
  "not-configured",
  "create-room",
  "guest-link",
  "consent-required",
  "transcript-ingest",
  "summary",
  "outreach-room",
  "guest-permissions",
  "livekit-token-shape",
  "host-guest-token-flow",
  "consent-token-gate",
  "room-ui-static",
  "no-secret-token-response",
];
if (!allowed.includes(scenario)) throw new Error(`unknown rooms replay "${scenario}"`);

const base = `http://${config.HOST === "0.0.0.0" ? "127.0.0.1" : config.HOST}:${config.PORT}`;
const dev = await postJson<{ user: { id: string; email: string }; token: string }>(`${base}/dev/users`, {
  email: `rooms-${scenario}@example.com`,
  displayName: "Rooms Replay",
});

if (scenario === "not-configured") {
  const room = await createRoom();
  const token = await postJsonAllowError(`${base}/rooms/${room.id}/host-token`, {}, dev.token);
  console.log(`not-configured: ${JSON.stringify(redactTokenFields(token))}`);
  if (isRoomNotConfigured(token)) {
    assertIncludes(JSON.stringify(token), config.ROOMS_ENABLED ? "rooms_not_configured" : "rooms_disabled");
  } else {
    assertTokenShape(token, "host");
  }
}

if (scenario === "create-room") {
  const room = await createRoom();
  console.log(`create-room: ${JSON.stringify(room)}`);
  assertIncludes(JSON.stringify(room), "livekit");
}

if (scenario === "guest-link") {
  const room = await createRoom();
  const link = await createGuestLink(room.id);
  console.log(`guest-link: ${JSON.stringify({ room, link })}`);
  assertIncludes(JSON.stringify(link), "guestLink");
  if (JSON.stringify(link).includes("inviteTokenHash")) throw new Error("guest link response exposed invite token hash");
}

if (scenario === "consent-required") {
  const room = await createRoom();
  await createGuestLink(room.id);
  const denied = await postJsonAllowError(`${base}/rooms/${room.id}/transcript`, { speakerLabel: "Investor", text: "Question before consent.", isFinal: true }, dev.token);
  console.log(`consent-required: ${JSON.stringify(denied)}`);
  assertIncludes(JSON.stringify(denied), "consent_required");
}

if (scenario === "transcript-ingest") {
  const room = await createRoom();
  const link = await createGuestLink(room.id);
  await postJson(`${base}/rooms/guest/${link.inviteToken}/consent`, { consentStatus: "granted", displayName: "Investor guest" });
  const segment = await addTranscript(room.id);
  console.log(`transcript-ingest: ${JSON.stringify(segment)}`);
  assertIncludes(JSON.stringify(segment), "send the deck");
}

if (scenario === "summary") {
  const room = await createRoom();
  const link = await createGuestLink(room.id);
  await postJson(`${base}/rooms/guest/${link.inviteToken}/consent`, { consentStatus: "granted", displayName: "Investor guest" });
  await addTranscript(room.id);
  const summary = await postJson(`${base}/rooms/${room.id}/generate-summary`, {}, dev.token);
  console.log(`summary: ${JSON.stringify(summary)}`);
  assertIncludes(JSON.stringify(summary), "draft_followup_message");
  assertIncludes(JSON.stringify(summary), "sendDisabled");
}

if (scenario === "outreach-room") {
  const investor = await createInvestorFixture();
  const room = await postJson(`${base}/outreach/investors/${investor.id}/create-room`, {}, dev.token);
  const rooms = await getJson(`${base}/outreach/investors/${investor.id}/rooms`, dev.token);
  console.log(`outreach-room: ${JSON.stringify({ room, rooms })}`);
  assertIncludes(JSON.stringify(room), "investor call");
  assertIncludes(JSON.stringify(rooms), investor.id);
}

if (scenario === "guest-permissions") {
  const room = await createRoom();
  const link = await createGuestLink(room.id);
  const guest = await getJson(`${base}/rooms/guest/${link.inviteToken}`);
  const blocked = await getJsonAllowError(`${base}/rooms/${room.id}/summary`);
  console.log(`guest-permissions: ${JSON.stringify({ guest, blocked })}`);
  if (JSON.stringify(guest).includes("outreachCampaignId")) throw new Error("guest saw host/private campaign fields");
  assertIncludes(JSON.stringify(blocked), "missing bearer token");
}

if (scenario === "livekit-token-shape") {
  const room = await createRoom();
  const response = await postJsonAllowError(`${base}/rooms/${room.id}/host-token`, {}, dev.token);
  console.log(`livekit-token-shape: ${JSON.stringify(redactTokenFields(response))}`);
  if (isRoomNotConfigured(response)) {
    assertIncludes(JSON.stringify(response), config.ROOMS_ENABLED ? "rooms_not_configured" : "rooms_disabled");
  } else {
    assertTokenShape(response, "host");
  }
}

if (scenario === "host-guest-token-flow") {
  const room = await createRoom();
  const link = await createGuestLink(room.id);
  await postJson(`${base}/rooms/guest/${link.inviteToken}/consent`, { consentStatus: "granted", displayName: "Investor guest" });
  const host = await postJsonAllowError(`${base}/rooms/${room.id}/host-token`, {}, dev.token);
  const guest = await postJsonAllowError(`${base}/rooms/guest/${link.inviteToken}/token`, { displayName: "Investor guest" });
  console.log(`host-guest-token-flow: ${JSON.stringify({ host: redactTokenFields(host), guest: redactTokenFields(guest) })}`);
  if (isRoomNotConfigured(host) || isRoomNotConfigured(guest)) {
    assertIncludes(JSON.stringify(host), config.ROOMS_ENABLED ? "rooms_not_configured" : "rooms_disabled");
  } else {
    assertTokenShape(host, "host");
    assertTokenShape(guest, "guest");
  }
}

if (scenario === "consent-token-gate") {
  const room = await createRoom();
  const link = await createGuestLink(room.id);
  const pending = await postJsonAllowError(`${base}/rooms/guest/${link.inviteToken}/token`, { displayName: "Investor guest" });
  await postJson(`${base}/rooms/guest/${link.inviteToken}/consent`, { consentStatus: "denied", displayName: "Investor guest" });
  const denied = await postJsonAllowError(`${base}/rooms/guest/${link.inviteToken}/token`, { displayName: "Investor guest" });
  console.log(`consent-token-gate: ${JSON.stringify({ pending, denied })}`);
  assertIncludes(JSON.stringify(pending), "consent_required");
  assertIncludes(JSON.stringify(denied), "consent_denied");
}

if (scenario === "room-ui-static") {
  const [html, js, css] = await Promise.all([
    readFile("services/voice-gateway/public/room.html", "utf8"),
    readFile("services/voice-gateway/public/room.js", "utf8"),
    readFile("services/voice-gateway/public/room.css", "utf8"),
  ]);
  console.log(`room-ui-static: ${JSON.stringify({ html: html.length, js: js.length, css: css.length })}`);
  assertIncludes(html, "Join LiveKit Room");
  assertIncludes(html, "No transcription before consent");
  assertIncludes(js, "participant_connected");
  assertIncludes(js, "track_subscribed");
  assertIncludes(css, "media-track");
}

if (scenario === "no-secret-token-response") {
  const room = await createRoom();
  const response = await postJsonAllowError(`${base}/rooms/${room.id}/host-token`, {}, dev.token);
  const text = JSON.stringify(response);
  console.log(`no-secret-token-response: ${JSON.stringify(redactTokenFields(response))}`);
  for (const marker of ["LIVEKIT_API_SECRET", "LIVEKIT_API_KEY", "apiSecret", "apiKey"]) {
    if (text.includes(marker)) throw new Error(`token response exposed secret marker ${marker}`);
  }
  if (config.LIVEKIT_API_SECRET && text.includes(config.LIVEKIT_API_SECRET)) throw new Error("token response exposed LiveKit API secret value");
  if (config.LIVEKIT_API_KEY && text.includes(config.LIVEKIT_API_KEY)) throw new Error("token response exposed LiveKit API key value");
}

async function createRoom() {
  const result = await postJson<{ room: { id: string } }>(
    `${base}/rooms`,
    { title: "Investor call", transcriptionEnabled: true, recordingEnabled: false, aiAgentEnabled: false },
    dev.token,
  );
  return result.room;
}

async function createGuestLink(roomId: string) {
  return postJson<{ inviteToken: string; guestLink: string }>(`${base}/rooms/${roomId}/guest-link`, { displayName: "Investor guest" }, dev.token);
}

async function addTranscript(roomId: string) {
  return postJson(`${base}/rooms/${roomId}/transcript`, { speakerLabel: "Founder", text: "We agreed that I will send the deck and follow up next week.", isFinal: true }, dev.token);
}

async function createInvestorFixture() {
  const [campaign] = await db
    .insert(outreachCampaigns)
    .values({
      userId: dev.user.id,
      name: "Rooms replay campaign",
      startupSummary: "AI assistant.",
      sectors: ["ai"],
      status: "draft",
      complianceBasis: "Draft-only replay.",
    })
    .returning();
  const [investor] = await db
    .insert(investorProfiles)
    .values({
      userId: dev.user.id,
      campaignId: campaign!.id,
      firmName: "Y Combinator",
      websiteUrl: "https://www.ycombinator.com",
      sourceConfidence: 0.8,
      status: "shortlisted",
    })
    .returning();
  return investor!;
}

function assertIncludes(text: string, expected: string): void {
  if (!text.includes(expected)) throw new Error(`expected output to include ${expected}: ${text}`);
}

function isRoomNotConfigured(response: any): boolean {
  const text = JSON.stringify(response);
  return text.includes("rooms_disabled") || text.includes("rooms_not_configured");
}

function assertTokenShape(response: any, role: "host" | "guest"): void {
  if (typeof response.token !== "string" || response.token.length < 32) throw new Error(`${role} token missing`);
  if (typeof response.livekitUrl !== "string" || !response.livekitUrl) throw new Error(`${role} livekitUrl missing`);
  if (response.participantRole !== role) throw new Error(`${role} role mismatch`);
  if (!response.providerRoomName || !response.roomId || !response.expiresAt) throw new Error(`${role} room metadata missing`);
  if (response.permissions?.canPublish !== true || response.permissions?.canSubscribe !== true || response.permissions?.canPublishData !== true) {
    throw new Error(`${role} permissions invalid`);
  }
}

function redactTokenFields(value: any): any {
  return JSON.parse(
    JSON.stringify(value, (key, item) => {
      if (/token/i.test(key) && typeof item === "string") return "[redacted]";
      return item;
    }),
  );
}

async function postJson<T = any>(url: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`POST ${url} failed: HTTP ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

async function postJsonAllowError<T = any>(url: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return (await response.json()) as T;
}

async function getJson<T = any>(url: string, token?: string): Promise<T> {
  const response = await fetch(url, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

async function getJsonAllowError<T = any>(url: string, token?: string): Promise<T> {
  const response = await fetch(url, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  return (await response.json()) as T;
}
