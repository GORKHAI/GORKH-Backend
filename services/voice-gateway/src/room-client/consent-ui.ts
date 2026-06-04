export type RoomMode = "host" | "guest";

export function parseRoomMode(pathname: string): { mode: RoomMode; roomId?: string; inviteToken?: string } {
  if (pathname.startsWith("/r/")) return { mode: "guest", inviteToken: decodeURIComponent(pathname.slice("/r/".length)) };
  if (pathname.startsWith("/rooms/ui/")) return { mode: "host", roomId: decodeURIComponent(pathname.slice("/rooms/ui/".length)) };
  return { mode: "host" };
}

export function consentAllowsJoin(mode: RoomMode, consentChecked: boolean, guestConsentStatus?: string): { ok: boolean; reason?: string } {
  if (!consentChecked) return { ok: false, reason: "Consent checkbox is required before joining." };
  if (mode === "guest" && guestConsentStatus === "denied") return { ok: false, reason: "Guest consent was denied." };
  if (mode === "guest" && guestConsentStatus !== "granted") return { ok: false, reason: "Guest consent must be granted before joining." };
  return { ok: true };
}
