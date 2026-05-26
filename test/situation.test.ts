import { describe, expect, it } from "vitest";
import { buildSituationBrief, inferSituationType } from "../src/situation/brief.js";

describe("situation inference", () => {
  it("infers bank loan situations", () => {
    expect(inferSituationType("I am going to the bank to discuss a loan")).toBe("bank_loan");
  });

  it("infers doctor visits", () => {
    expect(inferSituationType("Doctor appointment about blood test results and medication")).toBe("doctor_visit");
  });

  it("infers negotiations", () => {
    expect(inferSituationType("I am negotiating rent and contract terms")).toBe("negotiation");
  });

  it("builds playbook preparation questions", () => {
    const brief = buildSituationBrief({ description: "bank loan APR meeting" });
    expect(brief.playbookIds).toContain("bank-loan-basics");
    expect(brief.prepQuestions.length).toBeGreaterThan(0);
    expect(brief.riskLevel).toBe("high");
  });
});
