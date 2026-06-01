import WebSocket from "ws";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { investorProfiles, investorSources } from "../db/schema.js";

type Scenario =
  | "campaign-create"
  | "investor-research-no-provider"
  | "investor-research-live-if-configured"
  | "investor-scoring"
  | "draft-email"
  | "compliance-check"
  | "action-proposal"
  | "voice-investor-research";

const scenario = (process.argv[2] ?? "campaign-create") as Scenario;
const allowed: Scenario[] = [
  "campaign-create",
  "investor-research-no-provider",
  "investor-research-live-if-configured",
  "investor-scoring",
  "draft-email",
  "compliance-check",
  "action-proposal",
  "voice-investor-research",
];
if (!allowed.includes(scenario)) throw new Error(`unknown outreach replay "${scenario}"`);

const base = `http://${config.HOST === "0.0.0.0" ? "127.0.0.1" : config.HOST}:${config.PORT}`;
const wsBase = base.replace(/^http/, "ws");
const dev = await postJson<{ user: { id: string; email: string }; token: string }>(`${base}/dev/users`, {
  email: `outreach-${scenario}@example.com`,
  displayName: "Outreach Replay",
});

if (scenario === "campaign-create") {
  const campaign = await createCampaign();
  console.log(`campaign-create: ${JSON.stringify(campaign)}`);
  assertIncludes(JSON.stringify(campaign), "draft");
}

if (scenario === "investor-research-no-provider") {
  const campaign = await createCampaign();
  const id = campaign.campaign.id;
  const result = await postJson(`${base}/outreach/campaigns/${id}/research-investors`, { forceNoProvider: true }, dev.token);
  console.log(`investor-research-no-provider: ${JSON.stringify(result)}`);
  assertIncludes(JSON.stringify(result), "provider_not_configured");
  if (JSON.stringify(result).includes("@")) throw new Error("no-provider research should not invent emails");
}

if (scenario === "investor-research-live-if-configured") {
  const campaign = await createCampaign();
  const result = await postJson(`${base}/outreach/campaigns/${campaign.campaign.id}/research-investors`, {}, dev.token);
  console.log(`investor-research-live-if-configured: ${JSON.stringify(result)}`);
  if (!config.RESEARCH_PROVIDER || config.RESEARCH_PROVIDER === "none" || !result.providerStatus?.configured) {
    assertIncludes(JSON.stringify(result), "provider_not_configured");
  } else {
    if (!Array.isArray(result.investors) || result.investors.length < 1) throw new Error("configured provider did not return source-backed investor leads");
  }
}

if (scenario === "investor-scoring") {
  const campaign = await createCampaign();
  const investor = await createSourceBackedInvestor(dev.user.id, campaign.campaign.id);
  const listed = await getJson(`${base}/outreach/campaigns/${campaign.campaign.id}/investors`, dev.token);
  console.log(`investor-scoring: ${JSON.stringify({ investor, listed })}`);
  assertIncludes(JSON.stringify(listed), "fitScore");
}

if (scenario === "draft-email") {
  const campaign = await createCampaign();
  await createSourceBackedInvestor(dev.user.id, campaign.campaign.id);
  const drafts = await postJson(`${base}/outreach/campaigns/${campaign.campaign.id}/draft-emails`, defaultDraftBody(), dev.token);
  console.log(`draft-email: ${JSON.stringify(drafts)}`);
  assertIncludes(JSON.stringify(drafts), "opt out");
  assertIncludes(JSON.stringify(drafts), "proposed");
}

if (scenario === "compliance-check") {
  const { campaign, draft } = await createDraftFixture();
  const compliance = await getJson(`${base}/outreach/campaigns/${campaign.campaign.id}/compliance`, dev.token);
  console.log(`compliance-check: ${JSON.stringify({ draft, compliance })}`);
  assertIncludes(JSON.stringify(compliance), "outbound_compliance_check");
}

if (scenario === "action-proposal") {
  const { draft } = await createDraftFixture();
  const proposal = await postJson(`${base}/outreach/drafts/${draft.id}/create-action-proposal`, {}, dev.token);
  console.log(`action-proposal: ${JSON.stringify(proposal)}`);
  assertIncludes(JSON.stringify(proposal), "outbound_email_review");
  assertIncludes(JSON.stringify(proposal), "sendDisabled");
}

if (scenario === "voice-investor-research") {
  const events = await runVoiceInvestorResearch(dev.token);
  console.log(`voice-investor-research: ${JSON.stringify(events)}`);
  assertIncludes(JSON.stringify(events), "source-backed research");
  assertIncludes(JSON.stringify(events), "No emails will be sent");
}

async function createCampaign() {
  return postJson(`${base}/outreach/campaigns`, {
    name: "Nearmind seed outreach",
    startupSummary: "Nearmind/GORKH is a real-time adaptive AI assistant for live voice support, source-backed research, and daily task intelligence.",
    raiseTarget: "$1M seed",
    targetStage: "seed",
    targetGeography: "US Europe",
    sectors: ["ai", "productivity", "voice assistant"],
    complianceBasis: "Draft-only outreach. No sending is enabled.",
  }, dev.token);
}

async function createSourceBackedInvestor(userId: string, campaignId: string) {
  const [investor] = await db
    .insert(investorProfiles)
    .values({
      userId,
      campaignId,
      firmName: "Y Combinator",
      partnerName: null,
      roleTitle: null,
      websiteUrl: "https://www.ycombinator.com",
      linkedinUrl: null,
      email: null,
      location: "US",
      checkSize: null,
      stages: ["seed"],
      sectors: ["ai", "startup"],
      geographies: ["US"],
      thesisSummary: "Source-backed replay fixture using the public Y Combinator website as the source URL.",
      sourceConfidence: 0.8,
      fitScore: 0.78,
      fitReasons: ["Stage match: seed.", "Sector context references startups and AI."],
      riskFlags: ["No source-backed direct email found."],
      status: "discovered",
    })
    .returning();
  if (!investor) throw new Error("failed to create source-backed investor fixture");
  await db.insert(investorSources).values({
    investorId: investor.id,
    userId,
    sourceType: "website",
    title: "Y Combinator",
    url: "https://www.ycombinator.com",
    snippet: "Public website source for replay fixture.",
    credibilityScore: 0.8,
    fetchedAt: new Date(),
  });
  return investor;
}

async function createDraftFixture() {
  const campaign = await createCampaign();
  await createSourceBackedInvestor(dev.user.id, campaign.campaign.id);
  const drafts = await postJson<{ drafts: Array<{ id: string }> }>(`${base}/outreach/campaigns/${campaign.campaign.id}/draft-emails`, defaultDraftBody(), dev.token);
  const draft = drafts.drafts[0];
  if (!draft) throw new Error("draft fixture was not created");
  return { campaign, draft };
}

function defaultDraftBody() {
  return {
    senderIdentity: "the GORKH founder",
    ask: "Would you be open to a short introductory call next week?",
  };
}

async function runVoiceInvestorResearch(token: string) {
  const ws = new WebSocket(`${wsBase}/voice?token=${encodeURIComponent(token)}`);
  const events = collectEvents(ws);
  await open(ws);
  ws.send(
    JSON.stringify({
      type: "start",
      protocolVersion: 1,
      policy: "conversation_agent",
      situationDescription: "Fundraising planning.",
      consent: { granted: true, method: "user_tap", noticeText: "Live Assist is active.", participantCount: 1 },
      input: { kind: "text" },
      output: { kind: "text" },
      retentionPolicy: "ask_on_stop",
    }),
  );
  await waitFor(events, "voice_ack");
  ws.send(JSON.stringify({ type: "user_text", text: "Find investors for my seed AI voice assistant startup." }));
  await waitFor(events, "voice_assistant_text");
  ws.send(JSON.stringify({ type: "stop", save: false }));
  await delay(250);
  ws.close();
  return events.items;
}

function collectEvents(ws: WebSocket) {
  const items: Array<{ type: string; [key: string]: unknown }> = [];
  ws.on("message", (data) => items.push(JSON.parse(data.toString())));
  return { items };
}

function open(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
}

async function waitFor(events: { items: Array<{ type: string; [key: string]: unknown }> }, type: string, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const event = events.items.find((item) => item.type === type);
    if (event) return event;
    await delay(50);
  }
  throw new Error(`timed out waiting for ${type}: ${JSON.stringify(events.items)}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertIncludes(text: string, expected: string): void {
  if (!text.includes(expected)) throw new Error(`expected output to include ${expected}: ${text}`);
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

async function getJson<T = any>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}
