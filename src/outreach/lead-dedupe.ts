import type { InvestorProfile } from "../db/schema.js";

export function normalizeFirmName(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(ventures?|venture capital|capital|partners?|fund|vc|llc|ltd|inc|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizePartnerName(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeWebsiteDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

export function duplicateGroupFor(input: { canonicalFirmName?: string | null; websiteDomain?: string | null }): string | null {
  if (input.websiteDomain) return `domain:${input.websiteDomain}`;
  if (input.canonicalFirmName && input.canonicalFirmName.length >= 4) return `firm:${input.canonicalFirmName}`;
  return null;
}

export function isDuplicateCandidate(a: Pick<InvestorProfile, "id" | "canonicalFirmName" | "websiteDomain" | "partnerName">, b: Pick<InvestorProfile, "id" | "canonicalFirmName" | "websiteDomain" | "partnerName">): boolean {
  if (a.id === b.id) return false;
  if (a.websiteDomain && b.websiteDomain && a.websiteDomain === b.websiteDomain) return true;
  if (a.canonicalFirmName && b.canonicalFirmName && a.canonicalFirmName === b.canonicalFirmName) {
    const aPartner = normalizePartnerName(a.partnerName);
    const bPartner = normalizePartnerName(b.partnerName);
    return !aPartner || !bPartner || aPartner === bPartner;
  }
  return false;
}
