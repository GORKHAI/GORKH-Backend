import type { InvestorEmailStatus, InvestorSource } from "../db/schema.js";
import { normalizeWebsiteDomain } from "./lead-dedupe.js";

const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const contactPathPattern = /\b(contact|team|about|people|portfolio|submit)\b/i;

export interface ContactConfidenceResult {
  email: string | null;
  emailStatus: InvestorEmailStatus;
  emailConfidence: number | null;
  emailSourceId: string | null;
  contactUrl: string | null;
  contactConfidence: number;
  riskFlags: string[];
}

export function assessContactConfidence(input: {
  websiteUrl?: string | null;
  sources: Array<Pick<InvestorSource, "id" | "url" | "snippet" | "title">>;
  candidateEmail?: string | null;
}): ContactConfidenceResult {
  const riskFlags: string[] = [];
  const websiteDomain = normalizeWebsiteDomain(input.websiteUrl);
  const sourceEmail = input.sources
    .map((source) => ({ source, email: extractEmail(`${source.title ?? ""} ${source.snippet ?? ""}`) }))
    .find((item) => item.email);
  if (sourceEmail?.email) {
    const emailDomain = sourceEmail.email.split("@")[1]?.toLowerCase();
    const domainMatches = websiteDomain ? emailDomain === websiteDomain || emailDomain?.endsWith(`.${websiteDomain}`) : false;
    return {
      email: sourceEmail.email,
      emailStatus: "source_backed",
      emailConfidence: domainMatches ? 0.9 : 0.65,
      emailSourceId: sourceEmail.source.id,
      contactUrl: null,
      contactConfidence: domainMatches ? 0.9 : 0.65,
      riskFlags,
    };
  }
  if (input.candidateEmail) riskFlags.push("email_inference_not_allowed");
  const contactSource = input.sources.find((source) => contactPathPattern.test(source.url) || contactPathPattern.test(source.title ?? ""));
  if (contactSource) {
    return {
      email: null,
      emailStatus: "generic_contact",
      emailConfidence: null,
      emailSourceId: null,
      contactUrl: contactSource.url,
      contactConfidence: 0.55,
      riskFlags,
    };
  }
  return {
    email: null,
    emailStatus: "unknown",
    emailConfidence: null,
    emailSourceId: null,
    contactUrl: null,
    contactConfidence: 0.25,
    riskFlags: riskFlags.length ? riskFlags : ["no_source_backed_contact_found"],
  };
}

function extractEmail(text: string): string | null {
  const match = text.match(emailPattern);
  return match?.[0]?.toLowerCase() ?? null;
}
