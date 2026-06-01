const $ = (id) => document.getElementById(id);
const logEl = $("log");
const statusEl = $("status");
let mediaStream = null;

const path = window.location.pathname;
const guestToken = path.startsWith("/r/") ? decodeURIComponent(path.slice("/r/".length)) : null;
const roomId = path.startsWith("/rooms/ui/") ? decodeURIComponent(path.slice("/rooms/ui/".length)) : null;
$("modeChip").textContent = guestToken ? "guest" : "host";

function log(message, data) {
  const line = `[${new Date().toISOString()}] ${message}${data ? ` ${JSON.stringify(data, null, 2)}` : ""}`;
  logEl.textContent = `${line}\n${logEl.textContent}`.slice(0, 12000);
}

function backend() {
  return $("backendUrl").value.replace(/\/$/, "");
}

function authHeaders() {
  const token = $("jwt").value.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(body)}`);
  return body;
}

$("loadRoom").addEventListener("click", async () => {
  try {
    const data = guestToken
      ? await requestJson(`${backend()}/rooms/guest/${encodeURIComponent(guestToken)}`)
      : await requestJson(`${backend()}/rooms/${encodeURIComponent(roomId)}`, { headers: authHeaders() });
    statusEl.textContent = JSON.stringify(data, null, 2);
    log("room loaded", { mode: guestToken ? "guest" : "host" });
  } catch (err) {
    log("load failed", { error: String(err.message ?? err) });
  }
});

$("grantConsent").addEventListener("click", async () => {
  if (!guestToken) return log("guest consent requires /r/:inviteToken");
  if (!$("consent").checked) return log("check consent box first");
  try {
    const data = await requestJson(`${backend()}/rooms/guest/${encodeURIComponent(guestToken)}/consent`, {
      method: "POST",
      body: JSON.stringify({ consentStatus: "granted", displayName: $("displayName").value }),
    });
    statusEl.textContent = JSON.stringify(data, null, 2);
    log("guest consent granted");
  } catch (err) {
    log("consent failed", { error: String(err.message ?? err) });
  }
});

$("fetchToken").addEventListener("click", async () => {
  if (!$("consent").checked) return log("consent checkbox is required before token fetch");
  try {
    const data = guestToken
      ? await requestJson(`${backend()}/rooms/guest/${encodeURIComponent(guestToken)}/token`, {
          method: "POST",
          body: JSON.stringify({ displayName: $("displayName").value }),
        })
      : await requestJson(`${backend()}/rooms/${encodeURIComponent(roomId)}/host-token`, {
          method: "POST",
          headers: authHeaders(),
          body: "{}",
        });
    const safe = { ...data, token: data.token ? "[redacted]" : undefined };
    statusEl.textContent = JSON.stringify(safe, null, 2);
    log("token fetched", { livekitUrl: data.livekitUrl ?? null, note: "Token redacted. Browser SDK join is a future UI bundle step." });
  } catch (err) {
    log("token fetch failed", { error: String(err.message ?? err) });
  }
});

$("previewMedia").addEventListener("click", async () => {
  if (!$("consent").checked) return log("consent checkbox is required before local media preview");
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    $("localVideo").srcObject = mediaStream;
    log("local preview started");
  } catch (err) {
    log("local preview failed", { error: String(err.message ?? err) });
  }
});

$("stopMedia").addEventListener("click", stopMedia);
window.addEventListener("pagehide", stopMedia);

function stopMedia() {
  if (mediaStream) {
    for (const track of mediaStream.getTracks()) track.stop();
    mediaStream = null;
  }
  $("localVideo").srcObject = null;
  log("media stopped");
}
