import { describe, expect, it } from "vitest";
import { validateMcpInvocation } from "../src/connectors/mcp-adapter.js";
import { getConnectorManifest } from "../src/connectors/registry.js";
import { connectorPermissionSummary } from "../src/connectors/permissions.js";
import { classifyActionRisk } from "../src/actions/risk-classifier.js";
import { evaluateActionPolicy, isSafeInternalExecutable } from "../src/actions/policy.js";
import { createActionProposalSchema } from "../src/actions/types.js";

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
});
