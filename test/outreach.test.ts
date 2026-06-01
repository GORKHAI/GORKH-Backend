import { describe, expect, it } from "vitest";
import { evaluateActionPolicy, isSafeInternalExecutable } from "../src/actions/policy.js";
import { classifyActionRisk } from "../src/actions/risk-classifier.js";
import { checkOutboundCompliance } from "../src/outreach/compliance.js";
import { assessContactConfidence } from "../src/outreach/contact-confidence.js";
import { scoreInvestorFit } from "../src/outreach/investor-scoring.js";
import { isDuplicateCandidate, normalizeFirmName, normalizeWebsiteDomain } from "../src/outreach/lead-dedupe.js";

describe("investor outreach scoring", () => {
  it("scores source-backed sector, stage, and geography fit", () => {
    const result = scoreInvestorFit(
      {
        firmName: "Source-backed investor",
        stages: ["seed"],
        sectors: ["ai", "productivity"],
        geographies: ["Europe"],
        thesisSummary: "Invests in AI productivity startups.",
        sourceConfidence: 0.8,
        email: null,
      },
      {
        targetStage: "seed",
        sectors: ["ai"],
        targetGeography: "Europe",
        raiseTarget: "$1M",
        startupSummary: "AI assistant for productivity.",
      },
    );
    expect(result.fitScore).toBeGreaterThan(0.6);
    expect(result.fitReasons.join(" ")).toMatch(/Sector match|Stage match|Geography match/i);
    expect(result.riskFlags.join(" ")).toMatch(/No source-backed direct email/i);
  });
});

describe("investor lead dedupe and contact confidence", () => {
  it("normalizes firm names and domains conservatively", () => {
    expect(normalizeFirmName("The Acme Venture Capital Partners, LLC")).toBe("acme");
    expect(normalizeWebsiteDomain("https://www.example.com/contact")).toBe("example.com");
  });

  it("detects duplicate candidates only on firm or domain evidence", () => {
    expect(
      isDuplicateCandidate(
        { id: "1", canonicalFirmName: "acme", websiteDomain: "acme.com", partnerName: null },
        { id: "2", canonicalFirmName: "acme", websiteDomain: "acme.com", partnerName: null },
      ),
    ).toBe(true);
    expect(
      isDuplicateCandidate(
        { id: "1", canonicalFirmName: "acme", websiteDomain: "acme.com", partnerName: "A Person" },
        { id: "2", canonicalFirmName: "different", websiteDomain: "other.com", partnerName: "B Person" },
      ),
    ).toBe(false);
  });

  it("accepts source-backed email and rejects guessed email", () => {
    const backed = assessContactConfidence({
      websiteUrl: "https://fixture-investor.test",
      sources: [{ id: "source-1", url: "https://fixture-investor.test/contact", title: "Test fixture contact", snippet: "Test fixture email test-contact@example.test" }],
    });
    expect(backed.emailStatus).toBe("source_backed");
    expect(backed.email).toBe("test-contact@example.test");
    const guessed = assessContactConfidence({
      websiteUrl: "https://fixture-investor.test",
      candidateEmail: "partner@fixture-investor.test",
      sources: [{ id: "source-1", url: "https://fixture-investor.test", title: "Test fixture home", snippet: "No email here" }],
    });
    expect(guessed.email).toBeNull();
    expect(guessed.riskFlags).toContain("email_inference_not_allowed");
  });
});

describe("outreach compliance guardrails", () => {
  it("requires an opt-out line for cold outreach drafts", () => {
    const result = checkOutboundCompliance({
      subject: "Nearmind intro",
      body: "Hi, I am building Nearmind. Would you talk next week?",
      hasSourceBackedPersonalization: true,
    });
    expect(result.ok).toBe(false);
    expect(result.blockedReasons.join(" ")).toMatch(/opt.?out/i);
  });

  it("rejects misleading subjects and fake warm intros", () => {
    const result = checkOutboundCompliance({
      subject: "Re: our meeting",
      body: "Hi, mutual friend suggested I reach out. If this is not relevant, feel free to opt out.",
      hasSourceBackedPersonalization: true,
    });
    expect(result.ok).toBe(false);
    expect(result.blockedReasons.join(" ")).toMatch(/deceptive|warm intro/i);
  });

  it("passes concise draft-only outreach with opt-out and source-backed personalization", () => {
    const result = checkOutboundCompliance({
      subject: "Nearmind intro for AI productivity",
      body: "Hi team,\nI am the GORKH founder. I am reaching out because your published focus appears relevant.\nWould you be open to a short call?\nIf this is not relevant, feel free to opt out and I will not follow up.",
      hasSourceBackedPersonalization: true,
    });
    expect(result.ok).toBe(true);
    expect(result.notes.join(" ")).toMatch(/Draft-only/i);
  });
});

describe("outreach action policy", () => {
  it("keeps outbound email review as approval-gated external action", () => {
    expect(classifyActionRisk("outbound_email_review")).toBe("medium");
    const decision = evaluateActionPolicy({ actionType: "outbound_email_review", payload: { sendDisabled: true } });
    expect(decision).toMatchObject({ allowed: true, requiresApproval: true, external: true });
    expect(isSafeInternalExecutable("outbound_email_review")).toBe(false);
  });
});
