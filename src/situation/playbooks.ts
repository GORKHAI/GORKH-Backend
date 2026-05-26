import type { InternalType, RiskLevel } from "../db/schema.js";

export interface Playbook {
  id: string;
  type: InternalType;
  prepQuestions: string[];
  redFlags: string[];
  safeBoundaries: string[];
  defaultRiskLevel: RiskLevel;
}

const commonVerification = "Verify important decisions with the qualified professional or written source.";

export const playbooks: Record<InternalType, Playbook> = {
  bank_loan: {
    id: "bank-loan-basics",
    type: "bank_loan",
    prepQuestions: [
      "What is the APR, not just the nominal rate?",
      "What is the total repayment amount over the full term?",
      "Which fees are mandatory, optional, refundable, or recurring?",
      "Can I take the full written terms away before signing?",
    ],
    redFlags: ["Pressure to sign immediately", "Fees described verbally only", "Unclear fixed versus variable rate"],
    safeBoundaries: [
      "Do not make final financial decisions for the user.",
      "Suggest questions, written documentation, and independent verification.",
      commonVerification,
    ],
    defaultRiskLevel: "high",
  },
  doctor_visit: {
    id: "doctor-visit-questions",
    type: "doctor_visit",
    prepQuestions: [
      "What do these results mean in plain language?",
      "What symptoms or warning signs should I watch for?",
      "What are the next steps and follow-up timing?",
      "What side effects or interactions should I confirm?",
    ],
    redFlags: ["Unclear medication changes", "No follow-up plan", "Results explained without next steps"],
    safeBoundaries: [
      "Do not diagnose, recommend treatment, change medication, or rank medical decisions.",
      "Suggest questions, capture instructions, and remind the user to verify with the clinician.",
    ],
    defaultRiskLevel: "high",
  },
  business_meeting: {
    id: "meeting-action-capture",
    type: "business_meeting",
    prepQuestions: [
      "What outcome should be decided by the end?",
      "Who owns each likely action item?",
      "Which deadlines need exact dates?",
    ],
    redFlags: ["Vague ownership", "Soft deadlines", "Decisions without confirmation"],
    safeBoundaries: ["Capture owners, decisions, risks, and follow-ups without pretending certainty."],
    defaultRiskLevel: "medium",
  },
  negotiation: {
    id: "negotiation-clarity",
    type: "negotiation",
    prepQuestions: [
      "What is my walk-away point?",
      "Which terms must be in writing?",
      "What tradeoffs am I willing to offer?",
    ],
    redFlags: ["Pressure tactics", "Unclear price or term changes", "One-sided deadlines"],
    safeBoundaries: [
      "Do not make final legal, tax, investment, or financial decisions.",
      "Suggest clarifying questions, written terms, and verification.",
    ],
    defaultRiskLevel: "high",
  },
  sales_call: {
    id: "sales-call-discovery",
    type: "sales_call",
    prepQuestions: [
      "What problem is the client trying to solve?",
      "What budget, timeline, and decision process should be clarified?",
      "What next step should be confirmed?",
    ],
    redFlags: ["Pricing before scope", "No decision owner", "Unclear success criteria"],
    safeBoundaries: ["Suggest discovery questions and confirmation, not manipulative sales tactics."],
    defaultRiskLevel: "medium",
  },
  job_interview: {
    id: "job-interview-prep",
    type: "job_interview",
    prepQuestions: [
      "What role expectations should I clarify?",
      "What compensation range and process should I ask about?",
      "What examples demonstrate my fit?",
    ],
    redFlags: ["Unclear role scope", "Pressure around compensation", "No next-step timeline"],
    safeBoundaries: ["Suggest professional questions and reminders without fabricating credentials."],
    defaultRiskLevel: "medium",
  },
  legal_consultation: {
    id: "legal-consultation-clarity",
    type: "legal_consultation",
    prepQuestions: [
      "What are my options and risks?",
      "What documents should I provide or request?",
      "What fees and timelines should I expect?",
    ],
    redFlags: ["Advice without written scope", "Unclear fee terms", "Pressure to agree immediately"],
    safeBoundaries: [
      "Do not make final legal decisions or present legal advice as authoritative.",
      "Suggest questions, documentation, and verification with counsel.",
    ],
    defaultRiskLevel: "high",
  },
  personal_conversation: {
    id: "personal-conversation-respect",
    type: "personal_conversation",
    prepQuestions: [
      "What do I want to understand?",
      "What boundary do I need to state calmly?",
      "What would respectful progress look like?",
    ],
    redFlags: ["Escalating blame", "Mind-reading", "Control-oriented language"],
    safeBoundaries: [
      "Do not manipulate, detect lies, diagnose emotions, or tell the user how to control another person.",
      "Suggest de-escalation, active listening, clarifying questions, and respectful communication.",
    ],
    defaultRiskLevel: "medium",
  },
  general: {
    id: "general-situation-support",
    type: "general",
    prepQuestions: ["What outcome matters most?", "What facts should be captured?", "What next step should be confirmed?"],
    redFlags: ["Ambiguous commitments", "Missing documentation", "Unclear next steps"],
    safeBoundaries: ["Prefer questions, verification, and concise notes over final advice."],
    defaultRiskLevel: "medium",
  },
};

export function getPlaybooks(type: InternalType): Playbook[] {
  return [playbooks[type], ...(type === "general" ? [] : [playbooks.general])];
}

export function safetyBoundariesFor(type: InternalType): string[] {
  return getPlaybooks(type).flatMap((p) => p.safeBoundaries);
}
