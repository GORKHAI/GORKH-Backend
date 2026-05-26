import { describe, expect, it } from "vitest";
import { access, readFile } from "node:fs/promises";
import { extractProfileFactsFromText } from "../src/human/profile-extractor.js";
import { classifyProfileSensitivity } from "../src/human/privacy.js";
import { detectResearchNeed } from "../src/research/need-detector.js";
import { isPrivateHost } from "../src/research/fetch/fetcher.js";
import { classifySource, scoreSource } from "../src/research/verifier.js";
import { validateSourceBackedAnswer } from "../src/research/composer.js";
import { noneSearchProvider } from "../src/research/none.js";
import { ResearchProviderError } from "../src/research/types.js";
import { proposeSkillFromReflection, validateSkillManifest } from "../src/skills/learner.js";
import { decideToolPermission } from "../src/tools/permissions.js";
import { builtinToolManifests } from "../src/tools/manifests.js";
import { detectStressSignal } from "../src/stress/detector.js";
import { isSafeStressSupportText } from "../src/stress/safety.js";
import { buildReferenceInventory, renderReferenceInventoryMarkdown } from "../src/brain/reference-inventory.js";

describe("local reference inventory helpers", () => {
  it("does not claim local inspection when no references are present", () => {
    const inventory = buildReferenceInventory([]);
    const markdown = renderReferenceInventoryMarkdown(inventory);
    expect(markdown).toMatch(/No local Hermes/);
    expect(markdown).toMatch(/No local reference code inspection was claimed/);
  });

  it("classifies present archives and directories", () => {
    const inventory = buildReferenceInventory(["./hermes-agent-main.zip", "./OpenClaw", "./personaplex-main.tar.gz"]);
    expect(inventory.map((entry) => entry.kind)).toEqual(["hermes", "openclaw", "personaplex"]);
    expect(inventory[0]?.type).toBe("archive");
  });
});

describe("human profile extraction", () => {
  it("confirms explicit low-risk occupation facts", () => {
    const facts = extractProfileFactsFromText({ text: "I am a blockchain developer and I build mobile apps." });
    expect(facts.some((fact) => fact.kind === "occupation" && fact.status === "confirmed" && fact.content.includes("blockchain developer"))).toBe(true);
  });

  it("keeps inferred facts proposed", () => {
    const facts = extractProfileFactsFromText({ text: "Solana apps, smart contract testing, and mobile app flows." });
    expect(facts.some((fact) => fact.source === "inferred" && fact.status === "proposed")).toBe(true);
  });

  it("marks stress facts sensitive and not auto-confirmed", () => {
    const facts = extractProfileFactsFromText({ text: "I panic in meetings." });
    expect(facts[0]).toMatchObject({ kind: "sensitive_candidate", sensitivity: "sensitive", status: "proposed" });
    expect(classifyProfileSensitivity("I panic in meetings")).toBe("sensitive");
  });
});

describe("stress support safety", () => {
  it("detects conservative stress self-reports", () => {
    expect(detectStressSignal("I feel anxious before this call")).toMatchObject({ detected: true, crisis: false });
  });

  it("detects crisis boundary language", () => {
    expect(detectStressSignal("I might kill myself")).toMatchObject({ detected: true, crisis: true });
  });

  it("rejects diagnosis and treatment wording", () => {
    expect(isSafeStressSupportText("Pause before responding. Ask for two minutes.")).toBe(true);
    expect(isSafeStressSupportText("Here is your diagnosis and treatment plan.")).toBe(false);
  });
});

describe("research and fetch policy", () => {
  it("has Brain Console static assets", async () => {
    await access("services/voice-gateway/public/brain-console.html");
    await access("services/voice-gateway/public/brain-console.js");
    await access("services/voice-gateway/public/brain-console.css");
    await expect(readFile("services/voice-gateway/public/brain-console.html", "utf8")).resolves.toMatch(/GORKH Brain Console/);
  });

  it("detects freshness/source lookup needs", () => {
    const decision = detectResearchNeed({ text: "Check current mortgage rate ranges in France and find an official source." });
    expect(decision).toMatchObject({ needsResearch: true, researchKind: "source_verification" });
  });

  it("does not block deterministic cues on research", () => {
    expect(detectResearchNeed({ text: "Ask total repayment." }).needsResearch).toBe(false);
  });

  it("blocks local/private fetch targets", () => {
    expect(isPrivateHost("127.0.0.1")).toBe(true);
    expect(isPrivateHost("192.168.1.10")).toBe(true);
    expect(isPrivateHost("example.com")).toBe(false);
  });

  it("returns provider_not_configured for none provider", async () => {
    await expect(noneSearchProvider.search({ query: "official APR", maxResults: 1 })).rejects.toMatchObject({
      name: "ResearchProviderError",
      code: "provider_not_configured",
    } satisfies Partial<ResearchProviderError>);
  });

  it("rejects research answers with fake citations", () => {
    expect(() =>
      validateSourceBackedAnswer(
        {
          answer: "Fake cited answer.",
          citations: [{ url: "https://fake.example/source" }],
          confidence: 0.5,
        },
        [{ title: "Real", url: "https://official.example/source", snippet: "Real source." }],
      ),
    ).toThrow(/source_backed_citations/);
  });

  it("scores official sources above forums", () => {
    expect(classifySource("https://www.service-public.fr/foo")).toBe("official");
    expect(scoreSource({ title: "Gov", url: "https://example.gov/foo", snippet: "" })).toBeGreaterThan(
      scoreSource({ title: "Forum", url: "https://reddit.com/r/foo", snippet: "" }),
    );
  });
});

describe("tool and skill policy", () => {
  it("denies dangerous tools", () => {
    const execute = builtinToolManifests.find((tool) => tool.name === "execute_code");
    expect(execute).toBeDefined();
    expect(decideToolPermission(execute!)).toBe("denied");
  });

  it("proposes but does not auto-enable safe workflow skills", () => {
    const skill = proposeSkillFromReflection({ text: "bank loan meeting mortgage APR repayment", internalType: "bank_loan" });
    expect(skill?.name).toBe("bank_loan_prebrief");
    expect(skill?.steps.join(" ")).not.toMatch(/shell|submit form|final financial decision/i);
  });

  it("rejects dangerous declarative skill steps", () => {
    const result = validateSkillManifest({
      name: "unsafe",
      description: "unsafe workflow",
      triggerPattern: "anything",
      riskLevel: "high",
      steps: ["execute_code", "submit_form", "send_message_without_approval"],
    });
    expect(result).toMatchObject({ ok: false, reason: "dangerous_skill_step" });
  });
});
