import { consentAllowsJoin, parseRoomMode } from "./consent-ui.js";
import { redact, writeLog } from "./events.js";
import { createLiveKitRoomController, type TokenResponse } from "./livekit-room.js";

const modeInfo = parseRoomMode(window.location.pathname);
const state: {
  guestConsentStatus?: string;
  tokenResponse?: TokenResponse;
} = {};

const room = createLiveKitRoomController({
  localContainer: mustElement("localMedia"),
  remoteContainer: mustElement("remoteMedia"),
  participantList: mustElement("participantList"),
  log,
});

setText("modeChip", modeInfo.mode);
setDisplay("hostOnly", modeInfo.mode === "host");
setDisplay("guestOnly", modeInfo.mode === "guest");

on("loadRoom", "click", loadRoom);
on("grantConsent", "click", () => setGuestConsent("granted"));
on("denyConsent", "click", () => setGuestConsent("denied"));
on("joinRoom", "click", joinRoom);
on("leaveRoom", "click", () => room.leave());
on("addTranscript", "click", addTranscript);
on("generateSummary", "click", generateSummary);
on("loadSummary", "click", loadSummary);
on("endRoom", "click", endRoom);
window.addEventListener("pagehide", () => void room.leave());
window.addEventListener("beforeunload", () => void room.leave());

async function loadRoom(): Promise<void> {
  try {
    const data =
      modeInfo.mode === "guest"
        ? await requestJson(`${backend()}/rooms/guest/${encodeURIComponent(required(modeInfo.inviteToken, "invite token"))}`)
        : await requestJson(`${backend()}/rooms/${encodeURIComponent(required(modeInfo.roomId, "room id"))}`, { headers: authHeaders() });
    setJson("status", redact(data));
    setText("roomTitle", data.room?.title ?? data.room?.providerRoomName ?? "Investor Call Room");
    state.guestConsentStatus = data.participant?.consentStatus;
    updateConsentStatus(data);
    log("room_loaded", { mode: modeInfo.mode, providerStatus: data.providerStatus });
  } catch (err) {
    handleError(err);
  }
}

async function setGuestConsent(consentStatus: "granted" | "denied"): Promise<void> {
  if (modeInfo.mode !== "guest") return log("error", { message: "Guest consent requires /r/:inviteToken." });
  try {
    const data = await requestJson(`${backend()}/rooms/guest/${encodeURIComponent(required(modeInfo.inviteToken, "invite token"))}/consent`, {
      method: "POST",
      body: JSON.stringify({ consentStatus, displayName: inputValue("displayName"), email: optionalInputValue("email") }),
    });
    state.guestConsentStatus = data.participant?.consentStatus;
    setJson("status", redact(data));
    updateConsentStatus(data);
    log(consentStatus === "granted" ? "consent_granted" : "consent_denied", { participant: data.participant });
  } catch (err) {
    handleError(err);
  }
}

async function joinRoom(): Promise<void> {
  const allowed = consentAllowsJoin(modeInfo.mode, checkboxChecked("consent"), state.guestConsentStatus);
  if (!allowed.ok) return log("error", { message: allowed.reason });
  try {
    const tokenResponse = await fetchToken();
    if (!tokenResponse.livekitUrl || !tokenResponse.token) throw new Error("rooms_not_configured");
    state.tokenResponse = tokenResponse;
    log("token_received", redact({ ...tokenResponse, token: "[redacted]" }));
    await room.connect(tokenResponse);
  } catch (err) {
    handleError(err);
  }
}

async function fetchToken(): Promise<TokenResponse> {
  const data =
    modeInfo.mode === "guest"
      ? await requestJson(`${backend()}/rooms/guest/${encodeURIComponent(required(modeInfo.inviteToken, "invite token"))}/token`, {
          method: "POST",
          body: JSON.stringify({ displayName: inputValue("displayName") }),
        })
      : await requestJson(`${backend()}/rooms/${encodeURIComponent(required(modeInfo.roomId, "room id"))}/host-token`, {
          method: "POST",
          headers: authHeaders(),
          body: "{}",
        });
  setJson("status", redact(data));
  return data as TokenResponse;
}

async function addTranscript(): Promise<void> {
  if (modeInfo.mode !== "host") return log("error", { message: "Transcript ingestion is host-only." });
  try {
    const data = await requestJson(`${backend()}/rooms/${encodeURIComponent(required(modeInfo.roomId, "room id"))}/transcript`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        speakerLabel: inputValue("transcriptSpeaker") || "Speaker",
        text: inputValue("transcriptText"),
        isFinal: true,
      }),
    });
    setJson("status", redact(data));
    log("transcript_added", data.segment);
  } catch (err) {
    handleError(err);
  }
}

async function generateSummary(): Promise<void> {
  if (modeInfo.mode !== "host") return log("error", { message: "Summary is host-only." });
  try {
    const data = await requestJson(`${backend()}/rooms/${encodeURIComponent(required(modeInfo.roomId, "room id"))}/generate-summary`, {
      method: "POST",
      headers: authHeaders(),
      body: "{}",
    });
    setJson("summary", redact(data));
    log("summary_generated", data.summary);
  } catch (err) {
    handleError(err);
  }
}

async function loadSummary(): Promise<void> {
  if (modeInfo.mode !== "host") return log("error", { message: "Summary is host-only." });
  try {
    const data = await requestJson(`${backend()}/rooms/${encodeURIComponent(required(modeInfo.roomId, "room id"))}/summary`, { headers: authHeaders() });
    setJson("summary", redact(data));
  } catch (err) {
    handleError(err);
  }
}

async function endRoom(): Promise<void> {
  if (modeInfo.mode !== "host") return log("error", { message: "Ending room is host-only." });
  try {
    await room.leave();
    const data = await requestJson(`${backend()}/rooms/${encodeURIComponent(required(modeInfo.roomId, "room id"))}/end`, {
      method: "POST",
      headers: authHeaders(),
      body: "{}",
    });
    setJson("status", redact(data));
    log("room_ended", data.room);
  } catch (err) {
    handleError(err);
  }
}

function backend(): string {
  return inputValue("backendUrl").replace(/\/$/, "");
}

function authHeaders(): Record<string, string> {
  const token = inputValue("jwt");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function requestJson(url: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(body)}`);
  return body;
}

function updateConsentStatus(data: any): void {
  const status = data.participant?.consentStatus ?? data.participants?.map?.((p: any) => `${p.displayName ?? p.role}: ${p.consentStatus}`).join(", ");
  setText("consentStatus", status || "No participant consent loaded.");
}

function handleError(err: unknown): void {
  log("error", { message: String((err as Error).message ?? err) });
}

function log(event: Parameters<typeof writeLog>[1], data?: unknown): void {
  writeLog(mustElement("log"), event, data);
}

function on(id: string, event: string, handler: EventListener): void {
  mustElement(id).addEventListener(event, handler);
}

function mustElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element;
}

function inputValue(id: string): string {
  return (mustElement(id) as HTMLInputElement | HTMLTextAreaElement).value.trim();
}

function optionalInputValue(id: string): string | undefined {
  const value = inputValue(id);
  return value || undefined;
}

function checkboxChecked(id: string): boolean {
  return (mustElement(id) as HTMLInputElement).checked;
}

function setText(id: string, value: string): void {
  mustElement(id).textContent = value;
}

function setJson(id: string, value: unknown): void {
  mustElement(id).textContent = JSON.stringify(value, null, 2);
}

function setDisplay(id: string, visible: boolean): void {
  mustElement(id).style.display = visible ? "" : "none";
}

function required<T>(value: T | undefined, label: string): T {
  if (!value) throw new Error(`${label} is required`);
  return value;
}
