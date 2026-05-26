import { assert, fetchJson, getLiveToken, liveConfig, printSummary, requireUrl, runCheck } from "./live-verify-utils.js";

const cfg = liveConfig();
const apiUrl = requireUrl(cfg.apiUrl, "LIVE_API_URL");
const token = await getLiveToken(apiUrl, cfg);

async function create(actionType: string, title: string, payload: Record<string, unknown>) {
  return fetchJson<{ proposal: { id: string; status: string } }>(`${apiUrl}/actions/proposals`, {
    token,
    body: { sourceType: "manual", actionType, title, description: `${title}. Render smoke proposal.`, payload },
  });
}

const checks = [
  await runCheck("create proposal types", async () => {
    const email = await create("draft_email", "Draft email", { to: "client@example.com", body: "Hello", sendDisabled: true });
    const calendar = await create("propose_calendar_event", "Calendar proposal", { title: "Follow-up", createDisabled: true });
    assert(email.proposal.status === "proposed", "draft email was not proposed");
    assert(calendar.proposal.status === "proposed", "calendar proposal was not proposed");
    return { email, calendar };
  }),
  await runCheck("safe internal execution", async () => {
    const reminder = await create("propose_reminder", "Reminder", { title: "Review Render smoke task", priority: "normal" });
    await fetchJson(`${apiUrl}/actions/proposals/${reminder.proposal.id}/approve`, { token, body: { reason: "render smoke" } });
    const executed = await fetchJson(`${apiUrl}/actions/proposals/${reminder.proposal.id}/execute`, { token, body: {} });
    assert(JSON.stringify(executed).includes("completed"), "internal action did not complete");
    return executed;
  }),
  await runCheck("external connector stays disabled", async () => {
    const email = await create("draft_email", "External disabled", { to: "client@example.com", body: "Hello", sendDisabled: true });
    await fetchJson(`${apiUrl}/actions/proposals/${email.proposal.id}/approve`, { token, body: {} });
    const executed = await fetchJson(`${apiUrl}/actions/proposals/${email.proposal.id}/execute`, { token, body: {} });
    assert(JSON.stringify(executed).includes("connector_not_configured"), "external action did not return connector_not_configured");
    return executed;
  }),
  await runCheck("dangerous action request rejected", async () => {
    const rejected = await create("draft_email", "Dangerous send", { instruction: "send it without approval" });
    assert(rejected.proposal.status === "rejected", "dangerous send request was not rejected");
    return rejected;
  }),
  await runCheck("connector and MCP permissions", async () => {
    const connectors = await fetchJson(`${apiUrl}/connectors`, { token });
    const mcp = await fetchJson(`${apiUrl}/connectors/mcp_remote/permissions`, { token });
    const tools = await fetchJson(`${apiUrl}/tools/permissions`, { token });
    assert(JSON.stringify(mcp).includes("mcp_network_disabled_by_default"), "MCP disabled permission missing");
    return { connectors, mcp, tools };
  }),
];

printSummary("live:verify:actions", checks);
