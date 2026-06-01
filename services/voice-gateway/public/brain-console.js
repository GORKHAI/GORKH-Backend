const state = {
  token: "",
  profileReview: null,
  skills: [],
  subagentStream: null,
};
const opsMode = window.location.pathname.startsWith("/ops/brain");

const $ = (id) => document.getElementById(id);

function boot() {
  $("gatewayUrl").value = window.location.origin;
  $("backendUrl").value = guessBackendUrl();
  bind("createDevUser", createDevUser);
  bind("refreshAll", refreshAll);
  bind("clearLogs", () => {
    $("eventLog").textContent = "";
  });
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.action));
  });
  $("jwt").addEventListener("input", () => {
    state.token = $("jwt").value.trim();
    updateAuthStatus();
  });
  updateAuthStatus();
  loadProvidersForHeader().catch(logError);
}

function guessBackendUrl() {
  const url = new URL(window.location.href);
  if (url.hostname.startsWith("voice.")) return `${url.protocol}//api.${url.hostname.slice("voice.".length)}`;
  const port = url.port === "3010" ? "3000" : "3003";
  return `${url.protocol}//${url.hostname}:${port}`;
}

function bind(id, fn) {
  $(id).addEventListener("click", () => fn().catch(logError));
}

async function handleAction(action) {
  try {
    if (action === "dashboard") return show("dashboardOut", await get("/brain/dashboard"));
    if (action === "profileReview") return renderProfileReview(await get("/human/profile/review"));
    if (action === "dailyBriefGenerate") {
      const result = await post("/daily/brief/generate", {});
      if (result.dailyBrief?.id) $("dailyBriefId").value = result.dailyBrief.id;
      return show("dailyOut", result);
    }
    if (action === "dailyBriefToday") return show("dailyOut", await get("/daily/brief/today"));
    if (action === "dailyBriefFeedback") return show("dailyOut", await post("/daily/brief/feedback", { briefId: $("dailyBriefId").value.trim(), sectionKey: "top_priorities", rating: 5, action: "accepted" }));
    if (action === "dailyTasks") return show("dailyOut", await get("/daily/tasks"));
    if (action === "dailyCommitments") return show("dailyOut", await get("/daily/commitments"));
    if (action === "dailyCommitmentsReview") return show("dailyOut", await get("/daily/commitments/review"));
    if (action === "dailyFollowups") return show("dailyOut", await get("/daily/followups"));
    if (action === "dailyFollowupsReview") return show("dailyOut", await get("/daily/followups/review"));
    if (action === "commitmentPropose") return show("dailyOut", await post("/daily/commitments/propose", { text: $("commitmentText").value, sourceType: "manual" }));
    if (action === "weeklyReviewGenerate") return show("dailyOut", await post("/daily/weekly-review/generate", {}));
    if (action === "weeklyReviewLatest") return show("dailyOut", await get("/daily/weekly-review/latest"));
    if (action === "meetingPrep") return show("dailyOut", await post("/meetings/prep-pack", { situationDescription: $("meetingText").value }));
    if (action === "meetingRecap") return show("dailyOut", await post("/meetings/recap-pack", { sessionId: $("recapSessionId").value.trim() }));
    if (action === "meetingPacks") return show("dailyOut", await get("/meetings/packs"));
    if (action === "stressSettings") return show("stressOut", await get("/stress/settings"));
    if (action === "stressOptIn") return show("stressOut", await post("/stress/opt-in", {}));
    if (action === "stressOptOut") return show("stressOut", await post("/stress/opt-out", {}));
    if (action === "stressSupport") return show("stressOut", await post("/stress/support", { text: $("stressText").value }));
    if (action === "skills") return renderSkills(await get("/skills"));
    if (action === "skillMatch") return show("skillsOut", await post("/skills/match", { situationDescription: "I have a bank loan meeting tomorrow", internalType: "bank_loan" }));
    if (action === "reflections") return show("reflectionsOut", await get("/brain/reflections"));
    if (action === "researchProviders") return show("researchOut", await get("/research/providers"));
    if (action === "researchQuery") {
      const result = await post("/research/query", { text: $("researchText").value, intent: $("researchIntent").value });
      if (result.query?.id) $("qualityQueryId").value = result.query.id;
      return show("researchOut", result);
    }
    if (action === "brainQuery") {
      return show(
        "researchOut",
        await post("/brain/query", {
          text: $("researchText").value,
          allowResearch: $("allowResearch").checked,
          allowProfileContext: $("allowProfileContext").checked,
        }),
      );
    }
    if (action === "evaluationSummary") return show("qualityOut", await get("/evaluation/summary"));
    if (action === "evaluationEvents") return show("qualityOut", await get("/evaluation/events"));
    if (action === "governorStatus") return show("qualityOut", await get("/governor/status"));
    if (action === "governorBudget") return show("qualityOut", await get("/governor/budget"));
    if (action === "governorUsage") return show("qualityOut", await get("/governor/usage"));
    if (action === "researchEvaluate") return show("qualityOut", await post("/research/query/evaluate", { queryId: $("qualityQueryId").value.trim() }));
    if (action === "cueRecompute") {
      return show("qualityOut", await post(`/evaluation/recompute/cue/${$("qualityTargetId").value.trim()}`, { cueText: $("qualityCueText").value.trim() }));
    }
    if (action === "subagentCreate") return createSubagentTask();
    if (action === "subagentList") return show("subagentsOut", await get("/subagents/tasks"));
    if (action === "subagentQueue") return show("subagentsOut", await get("/subagents/queue/status"));
    if (action === "subagentMetrics") return show("subagentsOut", await get("/subagents/queue/metrics"));
    if (action === "subagentFailures") return show("subagentsOut", await get("/subagents/queue/failures"));
    if (action === "subagentNotifications") return show("subagentsOut", await get("/subagents/notifications"));
    if (action === "subagentStream") return startSubagentStream();
    if (action === "subagentReport") return show("subagentsOut", await get(`/subagents/tasks/${subagentTaskId()}/report`));
    if (action === "subagentCitations") return show("subagentsOut", await get(`/subagents/tasks/${subagentTaskId()}/citations`));
    if (action === "subagentEvents") return show("subagentsOut", await get(`/subagents/events/${subagentTaskId()}`));
    if (action === "subagentCancel") return show("subagentsOut", await post(`/subagents/tasks/${subagentTaskId()}/cancel`, {}));
    if (action === "actionCreate") return createActionProposal();
    if (action === "actionsList") return show("actionsOut", await get("/actions/proposals"));
    if (action === "actionGet") return show("actionsOut", await get(`/actions/proposals/${actionProposalId()}`));
    if (action === "actionApprove") return show("actionsOut", await post(`/actions/proposals/${actionProposalId()}/approve`, { reason: $("actionReason").value }));
    if (action === "actionReject") return show("actionsOut", await post(`/actions/proposals/${actionProposalId()}/reject`, { reason: $("actionReason").value }));
    if (action === "actionPreview") return show("actionsOut", await post(`/actions/proposals/${actionProposalId()}/preview`, {}));
    if (action === "actionExecute") return show("actionsOut", await post(`/actions/proposals/${actionProposalId()}/execute`, {}));
    if (action === "outreachCreateCampaign") return createOutreachCampaign();
    if (action === "outreachListCampaigns") return show("outreachOut", await get("/outreach/campaigns"));
    if (action === "outreachGetCampaign") return show("outreachOut", await get(`/outreach/campaigns/${outreachCampaignId()}`));
    if (action === "outreachResearchInvestors") return researchOutreachInvestors();
    if (action === "outreachListInvestors") return show("outreachOut", await get(`/outreach/campaigns/${outreachCampaignId()}/investors`));
    if (action === "outreachShortlistInvestor") return show("outreachOut", await post(`/outreach/investors/${outreachInvestorId()}/shortlist`, {}));
    if (action === "outreachDismissInvestor") return show("outreachOut", await post(`/outreach/investors/${outreachInvestorId()}/dismiss`, {}));
    if (action === "outreachInvestorQuality") return show("outreachOut", await post(`/outreach/investors/${outreachInvestorId()}/quality-review`, {}));
    if (action === "outreachMergeInvestor") return show("outreachOut", await post(`/outreach/investors/${outreachInvestorId()}/merge-into/${outreachMergeTargetId()}`, {}));
    if (action === "outreachDismissDuplicate") return show("outreachOut", await post(`/outreach/investors/${outreachInvestorId()}/dismiss-duplicate`, {}));
    if (action === "outreachDraftEmails") return draftOutreachEmails();
    if (action === "outreachListDrafts") return show("outreachOut", await get(`/outreach/campaigns/${outreachCampaignId()}/drafts`));
    if (action === "outreachGetDraft") return show("outreachOut", await get(`/outreach/drafts/${outreachDraftId()}`));
    if (action === "outreachDraftQuality") return show("outreachOut", await post(`/outreach/drafts/${outreachDraftId()}/quality-review`, {}));
    if (action === "outreachGetDraftQuality") return show("outreachOut", await get(`/outreach/drafts/${outreachDraftId()}/quality-review`));
    if (action === "outreachCompliance") return show("outreachOut", await get(`/outreach/campaigns/${outreachCampaignId()}/compliance`));
    if (action === "outreachQualitySummary") return show("outreachOut", await get(`/outreach/campaigns/${outreachCampaignId()}/quality-summary`));
    if (action === "outreachReviewPack") return show("outreachOut", await get(`/outreach/campaigns/${outreachCampaignId()}/review-pack`));
    if (action === "outreachCreateActionProposal") return createOutreachActionProposal();
    if (action === "outreachApproveDraft") return show("outreachOut", await post(`/outreach/drafts/${outreachDraftId()}/approve`, {}));
    if (action === "outreachRejectDraft") return show("outreachOut", await post(`/outreach/drafts/${outreachDraftId()}/reject`, {}));
    if (action === "outreachCreateRoom") return createRoomForInvestor();
    if (action === "outreachInvestorRooms") return show("outreachOut", await get(`/outreach/investors/${outreachInvestorId()}/rooms`));
    if (action === "roomCreate") return createRoom();
    if (action === "roomList") return show("roomsOut", await get("/rooms"));
    if (action === "roomLoad") return show("roomsOut", await get(`/rooms/${roomId()}`));
    if (action === "roomGuestLink") return createGuestLink();
    if (action === "roomHostToken") return showRedacted("roomsOut", await post(`/rooms/${roomId()}/host-token`, {}));
    if (action === "roomGuestConsent") return show("roomsOut", await post(`/rooms/guest/${roomInviteToken()}/consent`, { consentStatus: "granted", displayName: $("roomGuestName").value.trim(), email: optionalValue("roomGuestEmail") }));
    if (action === "roomGuestToken") return showRedacted("roomsOut", await post(`/rooms/guest/${roomInviteToken()}/token`, { displayName: $("roomGuestName").value.trim() }));
    if (action === "roomTranscript") return show("roomsOut", await post(`/rooms/${roomId()}/transcript`, { speakerLabel: $("roomSpeaker").value.trim(), text: $("roomTranscriptText").value.trim(), isFinal: true }));
    if (action === "roomTranscriptLoad") return show("roomsOut", await get(`/rooms/${roomId()}/transcript`));
    if (action === "roomSummary") return show("roomsOut", await post(`/rooms/${roomId()}/generate-summary`, {}));
    if (action === "roomSummaryLoad") return show("roomsOut", await get(`/rooms/${roomId()}/summary`));
    if (action === "roomAudit") return show("roomsOut", await get(`/rooms/${roomId()}/audit`));
    if (action === "roomEnd") return show("roomsOut", await post(`/rooms/${roomId()}/end`, {}));
    if (action === "connectorsList") return show("connectorsOut", await get("/connectors"));
    if (action === "connectorGet") return show("connectorsOut", await get(`/connectors/${connectorId()}`));
    if (action === "connectorPermissions") return show("connectorsOut", await get(`/connectors/${connectorId()}/permissions`));
    if (action === "connectorOauthStart") return show("connectorsOut", await get(`/connectors/oauth/${connectorId()}/start`));
    if (action === "googleCalendarOauthStart") return show("connectorsOut", await get("/connectors/oauth/google-calendar/start"));
    if (action === "connectorAccounts") return show("connectorsOut", await get("/connectors/accounts"));
    if (action === "connectorAccountGet") return show("connectorsOut", await get(`/connectors/accounts/${connectorAccountId()}`));
    if (action === "connectorFixtureImport") return importConnectorFixture();
    if (action === "connectorSyncPreview") return show("connectorsOut", await post(`/connectors/accounts/${connectorAccountId()}/sync-preview`, {}));
    if (action === "googleCalendarSyncPreview") return show("connectorsOut", await post("/connectors/google-calendar/sync-preview", { accountId: optionalConnectorAccountId() }));
    if (action === "googleCalendarSync") return show("connectorsOut", await post("/connectors/google-calendar/sync", { accountId: optionalConnectorAccountId() }));
    if (action === "googleCalendarEvents") return show("connectorsOut", await get("/connectors/google-calendar/events"));
    if (action === "connectorDisconnect") return show("connectorsOut", await post(`/connectors/accounts/${connectorAccountId()}/disconnect`, {}));
    if (action === "connectorConsentEvents") return show("connectorsOut", await get("/connectors/consent-events"));
    if (action === "tools") return show("toolsOut", await get("/tools"));
    if (action === "permissions") return show("toolsOut", await get("/tools/permissions"));
    if (action === "audit") return show("auditOut", await get("/brain/audit-events"));
    if (action === "session") return show("sessionOut", await get(`/sessions/${sessionId()}`));
    if (action === "transcript") return show("sessionOut", await get(`/sessions/${sessionId()}/transcript`));
    if (action === "cues") return show("sessionOut", await get(`/sessions/${sessionId()}/cues`));
    if (action === "voiceOutputs") return show("sessionOut", await get(`/sessions/${sessionId()}/voice-outputs`));
    if (action === "mobileSessionState") return show("sessionOut", await get(`/mobile/sessions/${sessionId()}/state`));
    if (action === "latencySummary") return show("sessionOut", await get(`/sessions/${sessionId()}/latency-summary`));
  } catch (err) {
    logError(err);
  }
}

async function createActionProposal() {
  const payload = JSON.parse($("actionPayload").value || "{}");
  const result = await post("/actions/proposals", {
    sourceType: "manual",
    actionType: $("actionType").value,
    title: $("actionTitle").value,
    description: $("actionDescription").value,
    payload,
  });
  $("actionProposalId").value = result.proposal.id;
  show("actionsOut", result);
}

async function importConnectorFixture() {
  const result = await post("/connectors/accounts/import-fixture", {
    provider: $("connectorId").value,
    accountEmail: $("connectorAccountEmail").value.trim(),
    items: JSON.parse($("connectorFixtureItems").value || "[]"),
  });
  if (result.account?.id) $("connectorAccountId").value = result.account.id;
  show("connectorsOut", result);
}

async function createOutreachCampaign() {
  const result = await post("/outreach/campaigns", {
    name: $("outreachCampaignName").value.trim(),
    startupSummary: $("outreachStartupSummary").value.trim(),
    raiseTarget: $("outreachRaiseTarget").value.trim() || null,
    targetStage: $("outreachStage").value.trim() || null,
    targetGeography: $("outreachGeography").value.trim() || null,
    sectors: $("outreachSectors").value.split(",").map((item) => item.trim()).filter(Boolean),
    complianceBasis: "Draft-only investor outreach from Brain Console. No email sending is enabled.",
  });
  if (result.campaign?.id) $("outreachCampaignId").value = result.campaign.id;
  show("outreachOut", result);
}

async function researchOutreachInvestors() {
  const result = await post(`/outreach/campaigns/${outreachCampaignId()}/research-investors`, {
    startupSummary: $("outreachStartupSummary").value.trim(),
    sector: $("outreachSectors").value,
    geography: $("outreachGeography").value.trim() || undefined,
    stage: $("outreachStage").value.trim() || undefined,
    raiseTarget: $("outreachRaiseTarget").value.trim() || undefined,
    targetInvestorType: "venture capital investors",
  });
  if (result.investors?.[0]?.id) $("outreachInvestorId").value = result.investors[0].id;
  show("outreachOut", result);
}

async function draftOutreachEmails() {
  const result = await post(`/outreach/campaigns/${outreachCampaignId()}/draft-emails`, {
    senderIdentity: $("outreachSenderIdentity").value.trim(),
    ask: $("outreachAsk").value.trim(),
    investorIds: $("outreachInvestorId").value.trim() ? [$("outreachInvestorId").value.trim()] : undefined,
  });
  if (result.drafts?.[0]?.id) $("outreachDraftId").value = result.drafts[0].id;
  show("outreachOut", result);
}

async function createOutreachActionProposal() {
  const result = await post(`/outreach/drafts/${outreachDraftId()}/create-action-proposal`, {});
  if (result.proposal?.id) $("actionProposalId").value = result.proposal.id;
  show("outreachOut", result);
}

async function createRoomForInvestor() {
  const result = await post(`/outreach/investors/${outreachInvestorId()}/create-room`, {});
  if (result.room?.id) $("roomId").value = result.room.id;
  show("outreachOut", result);
}

async function createRoom() {
  const result = await post("/rooms", {
    title: $("roomTitle").value.trim(),
    outreachCampaignId: optionalValue("outreachCampaignId"),
    investorId: optionalValue("outreachInvestorId"),
    transcriptionEnabled: true,
    recordingEnabled: false,
    aiAgentEnabled: false,
  });
  if (result.room?.id) $("roomId").value = result.room.id;
  show("roomsOut", result);
}

async function createGuestLink() {
  const result = await post(`/rooms/${roomId()}/guest-link`, { displayName: $("roomGuestName").value.trim(), email: optionalValue("roomGuestEmail") });
  if (result.inviteToken) $("roomInviteToken").value = result.inviteToken;
  show("roomsOut", result);
}

function startSubagentStream() {
  if (!state.token) throw new Error("Create or paste a JWT first.");
  if (state.subagentStream) state.subagentStream.close();
  const url = `${backendBase()}/subagents/stream?token=${encodeURIComponent(state.token)}`;
  state.subagentStream = new EventSource(url);
  state.subagentStream.onmessage = (event) => append("subagentsOut", `message ${event.data}`);
  for (const name of ["subagent_queued", "subagent_started", "subagent_progress", "subagent_report", "subagent_failed", "subagent_canceled", "subagent_expired", "subagent_suppressed"]) {
    state.subagentStream.addEventListener(name, (event) => append("subagentsOut", `${name} ${event.data}`));
  }
  append("subagentsOut", "SSE stream opened.");
}

async function createSubagentTask() {
  const kind = $("subagentKind").value;
  const text = $("subagentQuery").value;
  const input =
    kind === "skill_matcher"
      ? { situationDescription: text, internalType: "bank_loan" }
      : kind === "stress_support"
        ? { text, liveMode: false }
        : kind === "investor_research"
          ? { campaignId: $("outreachCampaignId").value.trim(), researchInput: { startupSummary: $("outreachStartupSummary").value.trim(), sector: $("outreachSectors").value, geography: $("outreachGeography").value.trim(), stage: $("outreachStage").value.trim() } }
          : kind === "investor_scoring"
            ? { campaignId: $("outreachCampaignId").value.trim() }
            : kind === "outreach_drafting"
              ? { campaignId: $("outreachCampaignId").value.trim(), senderIdentity: $("outreachSenderIdentity").value.trim(), ask: $("outreachAsk").value.trim() }
              : kind === "outreach_compliance"
                ? { draftId: $("outreachDraftId").value.trim() }
                : { query: text, intent: "bank_loan", internalType: "bank_loan" };
  const body = {
    kind,
    trigger: kind === "stress_support" ? "stress_support_request" : kind === "skill_matcher" ? "skill_match" : "user_request",
    priority: "normal",
    input,
    policy: {
      allowResearch: kind === "research" || kind === "investor_research",
      allowProfileContext: kind === "skill_matcher",
      allowMemory: false,
      allowStressSupport: kind === "stress_support",
      allowUserFacingReport: true,
      liveDelivery: $("subagentDelivery").value,
    },
  };
  const result = await post("/subagents/tasks", body);
  $("subagentTaskId").value = result.task.id;
  show("subagentsOut", result);
}

async function createDevUser() {
  const body = { email: $("email").value.trim(), displayName: $("displayName").value.trim() };
  const result = await fetchJson(`${backendBase()}${opsMode ? "/ops/test-user" : "/dev/users"}`, {
    method: "POST",
    body,
    adminToken: $("opsAdminToken")?.value?.trim() || "",
  });
  state.token = result.token;
  $("jwt").value = result.token;
  updateAuthStatus(`Authenticated as ${result.user.email}`);
  log("Created dev user. JWT is visible only in this input and is not stored by default.");
  await refreshAll();
}

async function refreshAll() {
  await Promise.allSettled([
    handleAction("dashboard"),
    handleAction("profileReview"),
    handleAction("stressSettings"),
    handleAction("skills"),
    handleAction("reflections"),
    handleAction("researchProviders"),
    handleAction("permissions"),
    handleAction("audit"),
  ]);
}

async function loadProvidersForHeader() {
  const providers = await fetchJson(`${gatewayBase()}/providers`);
  log(`Gateway providers: ${JSON.stringify(providers)}`);
}

async function get(path) {
  return fetchJson(`${backendBase()}${path}`);
}

async function post(path, body) {
  return fetchJson(`${backendBase()}${path}`, { method: "POST", body });
}

async function fetchJson(url, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (options.adminToken) headers.Authorization = `Bearer ${options.adminToken}`;
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`${response.status} ${url}: ${JSON.stringify(body)}`);
  return body;
}

function renderProfileReview(review) {
  state.profileReview = review;
  const groups = [
    ["Confirmed", review.confirmedFacts ?? []],
    ["Proposed", review.proposedFacts ?? []],
    ["Sensitive", review.sensitiveCandidates ?? []],
    ["Rejected", review.rejectedFacts ?? []],
  ];
  $("profileReviewOut").innerHTML = groups
    .map(([title, facts]) => `<div><h3>${escapeHtml(title)} <span class="chip">${facts.length}</span></h3>${facts.map(renderFact).join("") || "<p>No items</p>"}</div>`)
    .join("");
}

function renderFact(fact) {
  const controls =
    fact.status === "proposed"
      ? `<div class="actions"><button class="button primary" data-fact-confirm="${fact.id}">Confirm</button><button class="button danger" data-fact-reject="${fact.id}">Reject</button></div>`
      : "";
  queueMicrotask(() => {
    document.querySelectorAll("[data-fact-confirm]").forEach((button) => button.addEventListener("click", () => confirmFact(button.dataset.factConfirm)));
    document.querySelectorAll("[data-fact-reject]").forEach((button) => button.addEventListener("click", () => rejectFact(button.dataset.factReject)));
  });
  return `<div class="fact"><strong>${escapeHtml(fact.kind)} · ${escapeHtml(fact.sensitivity)} · ${escapeHtml(fact.status)}</strong><div>${escapeHtml(fact.content)}</div>${controls}</div>`;
}

async function confirmFact(id) {
  await post(`/human/profile/facts/${id}/confirm`, {});
  log(`Confirmed fact ${id}`);
  await handleAction("profileReview");
  await handleAction("dashboard");
}

async function rejectFact(id) {
  await post(`/human/profile/facts/${id}/reject`, {});
  log(`Rejected fact ${id}`);
  await handleAction("profileReview");
  await handleAction("dashboard");
}

function renderSkills(result) {
  state.skills = result.skills ?? [];
  $("skillsOut").innerHTML = "";
  const wrapper = document.createElement("div");
  state.skills.forEach((skill) => {
    const row = document.createElement("div");
    row.className = "fact";
    row.innerHTML = `<strong>${escapeHtml(skill.name)} · ${escapeHtml(skill.status)} · ${escapeHtml(skill.riskLevel)}</strong><div>${escapeHtml(skill.description)}</div>`;
    const actions = document.createElement("div");
    actions.className = "actions";
    for (const [label, path] of [
      ["Approve", "approve"],
      ["Enable", "enable"],
      ["Disable", "disable"],
    ]) {
      const button = document.createElement("button");
      button.className = "button";
      button.textContent = label;
      button.addEventListener("click", async () => {
        await post(`/skills/${skill.id}/${path}`, {});
        await handleAction("skills");
      });
      actions.appendChild(button);
    }
    row.appendChild(actions);
    wrapper.appendChild(row);
  });
  $("skillsOut").appendChild(wrapper);
}

function sessionId() {
  const id = $("sessionId").value.trim();
  if (!id) throw new Error("Session ID is required");
  return encodeURIComponent(id);
}

function subagentTaskId() {
  const id = $("subagentTaskId").value.trim();
  if (!id) throw new Error("Task ID is required");
  return encodeURIComponent(id);
}

function actionProposalId() {
  const id = $("actionProposalId").value.trim();
  if (!id) throw new Error("Proposal ID is required");
  return encodeURIComponent(id);
}

function outreachCampaignId() {
  const id = $("outreachCampaignId").value.trim();
  if (!id) throw new Error("Outreach campaign ID is required.");
  return id;
}

function outreachInvestorId() {
  const id = $("outreachInvestorId").value.trim();
  if (!id) throw new Error("Investor ID is required.");
  return id;
}

function outreachMergeTargetId() {
  const id = $("outreachMergeTargetId").value.trim();
  if (!id) throw new Error("Merge target investor ID is required.");
  return id;
}

function outreachDraftId() {
  const id = $("outreachDraftId").value.trim();
  if (!id) throw new Error("Outreach draft ID is required.");
  return id;
}

function roomId() {
  const id = $("roomId").value.trim();
  if (!id) throw new Error("Room ID is required.");
  return encodeURIComponent(id);
}

function roomInviteToken() {
  const token = $("roomInviteToken").value.trim();
  if (!token) throw new Error("Guest invite token is required.");
  return encodeURIComponent(token);
}

function connectorId() {
  return encodeURIComponent($("connectorId").value);
}

function connectorAccountId() {
  const id = $("connectorAccountId").value.trim();
  if (!id) throw new Error("Connector account ID is required");
  return encodeURIComponent(id);
}

function optionalConnectorAccountId() {
  const id = $("connectorAccountId").value.trim();
  return id || null;
}

function optionalValue(id) {
  const value = $(id).value.trim();
  return value || undefined;
}

function backendBase() {
  return $("backendUrl").value.replace(/\/$/, "");
}

function gatewayBase() {
  return $("gatewayUrl").value.replace(/\/$/, "");
}

function updateAuthStatus(message) {
  const hasToken = Boolean(($("jwt").value || state.token).trim());
  $("authStatus").innerHTML = `<span class="${hasToken ? "ok" : "bad"}">${escapeHtml(message ?? (hasToken ? "Token loaded" : "No token loaded"))}</span>`;
}

function show(id, value) {
  $(id).textContent = JSON.stringify(value, null, 2);
  log(`${id}: loaded`);
}

function showRedacted(id, value) {
  const safe = { ...value, token: value?.token ? "[redacted]" : value?.token };
  show(id, safe);
}

function append(id, value) {
  $(id).textContent = `${String(value)}\n${$(id).textContent}`.slice(0, 30000);
  log(`${id}: event`);
}

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  $("eventLog").textContent = `${line}\n${$("eventLog").textContent}`.slice(0, 20000);
}

function logError(err) {
  log(`ERROR: ${err.message ?? String(err)}`);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

boot();
