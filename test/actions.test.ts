import { describe, expect, it } from "vitest";
import { validateMcpInvocation } from "../src/connectors/mcp-adapter.js";
import { getConnectorManifest } from "../src/connectors/registry.js";
import { connectorPermissionSummary } from "../src/connectors/permissions.js";
import { connectorConsentText } from "../src/connectors/oauth/consent.js";
import { oauthReadiness } from "../src/connectors/oauth/callback.js";
import { enabledScopeStrings, validateRequestedScopes } from "../src/connectors/oauth/scopes.js";
import { GOOGLE_CALENDAR_EVENTS_READONLY_SCOPE, validateGoogleCalendarScopes } from "../src/connectors/oauth/google-scopes.js";
import { normalizeGoogleCalendarEvent } from "../src/connectors/oauth/google-calendar.js";
import { normalizeGmailMessage } from "../src/connectors/oauth/gmail.js";
import { assertNoRawToken, tokenVaultStatus } from "../src/connectors/oauth/token-vault.js";
import { classifyActionRisk } from "../src/actions/risk-classifier.js";
import { evaluateActionPolicy, isSafeInternalExecutable } from "../src/actions/policy.js";
import { createActionProposalSchema } from "../src/actions/types.js";
import { previewActionProposal } from "../src/actions/preview.js";

describe("action approval policy", () => {
  it("classifies external drafts and calendar proposals as review-gated", () => {
    expect(classifyActionRisk("draft_email")).toBe("medium");
    expect(classifyActionRisk("propose_calendar_event")).toBe("medium");
    const decision = evaluateActionPolicy({ actionType: "draft_email", payload: { body: "Please confirm the next step." } });
    expect(decision).toMatchObject({ allowed: true, requiresApproval: true, external: true });
  });

  it("rejects disabled dangerous capabilities in payload", () => {
    const decision = evaluateActionPolicy({ actionType: "draft_email", payload: { instruction: "send it without approval" } });
    expect(decision.allowed).toBe(false);
    expect(decision.riskLevel).toBe("high");
  });

  it("validates proposal payloads", () => {
    const parsed = createActionProposalSchema.parse({
      actionType: "propose_reminder",
      title: "Reminder",
      description: "Create internal reminder",
      payload: { title: "Call client" },
    });
    expect(parsed.sourceType).toBe("manual");
  });

  it("allows only safe internal execution types", () => {
    expect(isSafeInternalExecutable("propose_reminder")).toBe(true);
    expect(isSafeInternalExecutable("draft_email")).toBe(false);
    expect(isSafeInternalExecutable("propose_calendar_event")).toBe(false);
  });
});

describe("connector manifests and MCP policy", () => {
  it("keeps connectors disabled by default with explicit permissions", () => {
    const gmail = getConnectorManifest("google_gmail");
    expect(gmail?.enabled).toBe(false);
    expect(gmail?.permissions).toContain("draft_email");
    expect(gmail?.permissions).toContain("send_email_requires_approval");
  });

  it("exposes disabled dangerous connector capabilities", () => {
    const mcp = getConnectorManifest("mcp_remote");
    expect(mcp).toBeTruthy();
    const summary = connectorPermissionSummary(mcp!);
    expect(summary.disabledCapabilities).toContain("arbitrary_mcp_tool_invocation");
    expect(summary.permissions).toContain("mcp_network_disabled_by_default");
  });

  it("blocks arbitrary MCP invocation", () => {
    expect(() => validateMcpInvocation({ connectorId: "mcp_remote", toolName: "anything", input: {} })).toThrow(/disabled in v0/i);
  });

  it("blocks MCP shell names and secret-bearing input", () => {
    expect(() => validateMcpInvocation({ connectorId: "mcp_remote", toolName: "bash", input: {} })).toThrow(/disabled/i);
    expect(() => validateMcpInvocation({ connectorId: "mcp_remote", toolName: "read", input: { apiKey: "redacted-test-secret" } })).toThrow(/Secrets/i);
  });
});

describe("connector OAuth readiness", () => {
  it("registers least-privilege Google scopes", () => {
    expect(enabledScopeStrings("google_calendar")).toContain(GOOGLE_CALENDAR_EVENTS_READONLY_SCOPE);
    expect(enabledScopeStrings("google_gmail")).toContain("https://www.googleapis.com/auth/gmail.metadata");
    expect(validateGoogleCalendarScopes([GOOGLE_CALENDAR_EVENTS_READONLY_SCOPE]).ok).toBe(true);
    expect(validateGoogleCalendarScopes(["https://www.googleapis.com/auth/calendar.events"]).ok).toBe(false);
    const validation = validateRequestedScopes("google_gmail", ["https://www.googleapis.com/auth/gmail.send"]);
    expect(validation.ok).toBe(false);
  });

  it("builds explicit consent text and reports OAuth disabled without env", () => {
    expect(connectorConsentText("google_calendar", enabledScopeStrings("google_calendar"))).toContain("read-only");
    const readiness = oauthReadiness("google_calendar");
    expect(readiness.enabled).toBe(false);
    expect(readiness.missing.length).toBeGreaterThan(0);
  });

  it("does not allow raw token storage", () => {
    expect(tokenVaultStatus().rawTokenStorageAllowed).toBe(false);
    expect(() => assertNoRawToken({ access_token: "redacted-test-value" })).toThrow(/raw connector tokens/i);
    expect(() => assertNoRawToken({ accessToken: "redacted-test-value" })).toThrow(/raw connector tokens/i);
  });

  it("normalizes fixture connector items without fake live data", () => {
    const event = normalizeGoogleCalendarEvent({
      id: "event-1",
      summary: "Bank meeting",
      description: "Join https://meet.example/secret",
      start: { dateTime: "2026-06-01T09:00:00.000Z" },
      attendees: [{ email: "person@example.com" }],
      hangoutLink: "https://meet.example/secret",
    } as never);
    const message = normalizeGmailMessage({ id: "msg-1", subject: "Follow up", snippet: "Send documents" });
    expect(event.itemType).toBe("calendar_event");
    expect(JSON.stringify(event)).not.toContain("person@example.com");
    expect(JSON.stringify(event)).not.toContain("meet.example");
    expect(message.itemType).toBe("email_message");
  });

  it("previews external actions as blocked draft/proposal only", () => {
    const preview = previewActionProposal({
      id: "00000000-0000-0000-0000-000000000001",
      userId: "00000000-0000-0000-0000-000000000002",
      sessionId: null,
      sourceType: "manual",
      actionType: "draft_email",
      title: "Draft",
      description: "Draft only",
      payload: {},
      riskLevel: "medium",
      status: "approved",
      requiresApproval: true,
      createdAt: new Date(),
      expiresAt: null,
      updatedAt: new Date(),
    });
    expect(preview.canExecute).toBe(false);
    expect(preview.cannotExecuteReason).toBe("draft_only_no_send");
  });
});
