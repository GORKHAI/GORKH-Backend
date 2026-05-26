const $ = (id) => document.getElementById(id);

const gatewayHttp = window.location.origin;
const gatewayWs = gatewayHttp.replace(/^http/, "ws");
const liveBase = window.location.pathname.startsWith("/ops/live") ? "/ops/live" : "/dev/live";
const opsMode = liveBase.startsWith("/ops");
let backendHttp = guessBackendUrl();

let socket = null;
let token = "";
let startAccepted = false;
let ttsMuted = false;
let currentSpeechId = "";
let audioContext = null;
let mediaStream = null;
let workletNode = null;

$("backendUrl").textContent = backendHttp;
$("backendHttpInput").value = backendHttp;
$("gatewayUrl").textContent = gatewayHttp;
$("backendHttpInput").addEventListener("change", () => {
  backendHttp = $("backendHttpInput").value.replace(/\/$/, "");
  $("backendUrl").textContent = backendHttp;
});

void refreshProviders();

$("scenario").addEventListener("change", () => {
  const value = $("scenario").value;
  const descriptions = {
    bank_loan: "I am going to the bank to discuss a loan.",
    doctor_visit: "I have a doctor appointment about blood test results.",
    business_meeting: "I have a business meeting with a partner about project delivery.",
    negotiation: "I am negotiating rent and contract terms.",
  };
  $("situationDescription").value = descriptions[value] || descriptions.bank_loan;
});

$("createUser").addEventListener("click", async () => {
  try {
    const opsToken = $("opsAdminToken")?.value?.trim() || "";
    const authPath = opsMode ? "/ops/test-user" : "/dev/users";
    const headers = { "Content-Type": "application/json" };
    if (opsMode && opsToken) headers.Authorization = `Bearer ${opsToken}`;
    const response = await fetch(`${backendHttp}${authPath}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: $("email").value, displayName: $("displayName").value }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(body));
    token = body.token;
    $("token").value = token;
    $("authStatus").textContent = `user ${body.user.id}`;
    log("events", "created dev user");
  } catch (err) {
    log("events", `auth error: ${err.message}`);
  }
});

$("connect").addEventListener("click", () => {
  token = $("token").value.trim();
  if (!token) {
    log("events", "missing token");
    return;
  }
  socket = new WebSocket(`${gatewayWs}/gateway/voice?token=${encodeURIComponent(token)}`);
  socket.binaryType = "arraybuffer";
  socket.addEventListener("open", () => {
    $("socketStatus").textContent = "open";
    log("events", "socket open");
  });
  socket.addEventListener("message", (event) => handleServerEvent(JSON.parse(event.data)));
  socket.addEventListener("close", () => {
    $("socketStatus").textContent = "closed";
    startAccepted = false;
    void stopMic();
    log("events", "socket closed");
  });
  socket.addEventListener("error", () => log("events", "socket error"));
});

$("start").addEventListener("click", async () => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    log("events", "connect websocket first");
    return;
  }
  if (!$("consent").checked) {
    log("events", "consent checkbox required before start");
    return;
  }
  const microphone = $("inputKind").value === "microphone_pcm16";
  send({
    type: "start",
    policy: $("policy").value,
    situationDescription: $("situationDescription").value,
    title: $("title").value,
    consent: {
      granted: true,
      method: "user_tap",
      noticeText: $("notice").value,
      participantCount: $("policy").value === "whisper_copilot" ? 2 : 1,
      jurisdiction: "unknown",
    },
    input: microphone ? { kind: "pcm16", sampleRate: 16000, channels: 1 } : { kind: "text" },
    output: { kind: $("outputKind").value },
    retentionPolicy: "ask_on_stop",
  });
});

$("stopDiscard").addEventListener("click", () => stop(false));
$("stopSave").addEventListener("click", () => stop(true));
$("disconnect").addEventListener("click", () => {
  void stopMic();
  socket?.close();
});
$("pushUserText").addEventListener("click", () => send({ type: "user_text", text: $("userText").value }));
$("pushTranscript").addEventListener("click", () => send({ type: "transcript", speaker: "speaker_1", text: $("transcriptText").value, offsetMs: Date.now() % 100000 }));
$("barge").addEventListener("click", () => send({ type: "speech_started" }));
$("mute").addEventListener("click", () => {
  ttsMuted = !ttsMuted;
  $("mute").textContent = ttsMuted ? "Unmute Client TTS" : "Mute Client TTS";
  if (ttsMuted) speechSynthesis.cancel();
});
$("clear").addEventListener("click", () => {
  for (const id of ["events", "transcripts", "cues", "assistant", "metrics", "privacy"]) $(id).textContent = "";
});

function stop(save) {
  send({ type: "stop", save });
  void stopMic();
}

function send(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    log("events", "socket is not open");
    return;
  }
  socket.send(JSON.stringify(payload));
}

function handleServerEvent(event) {
  log("events", JSON.stringify(event));
  if (event.type === "gateway_ack") {
    startAccepted = true;
    $("gatewaySessionId").textContent = event.gatewaySessionId;
    $("backendSessionId").textContent = event.backendSessionId;
    $("policyStatus").textContent = event.policy;
    $("inputStatus").textContent = event.inputKind;
    $("outputStatus").textContent = event.outputStrategy;
    if (event.inputKind === "pcm16") void startMic();
  }
  if (event.type === "gateway_state" || event.type === "voice_state") $("stateStatus").textContent = event.state;
  if (event.type === "gateway_provider_error" || event.type === "gateway_error" || event.type === "error") {
    if (event.stage === "asr" || event.stage === "provider") void stopMic();
  }
  if (event.type === "gateway_asr_final" || event.type === "voice_segment") log("transcripts", `${event.speaker}: ${event.text}`);
  if (event.type === "voice_cue") log("cues", `${event.cue.spokenCue} | ${event.cue.visualCue}`);
  if (event.type === "voice_assistant_text") log("assistant", event.text);
  if (event.type === "gateway_metrics") log("metrics", JSON.stringify(event.latencyMs));
  if (event.type === "summary") log("privacy", `summary storedMemoryIds=${JSON.stringify(event.storedMemoryIds)}`);
  if (event.type === "gateway_client_tts_instruction") speak(event);
  if (event.type === "voice_cancel_speech") {
    speechSynthesis.cancel();
    currentSpeechId = "";
    $("speechStatus").textContent = `canceled ${event.speechId}`;
    log("assistant", `speech canceled: ${event.reason}`);
  }
}

async function startMic() {
  if (!$("consent").checked || !startAccepted || $("inputKind").value !== "microphone_pcm16") return;
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new AudioContext();
    await audioContext.audioWorklet.addModule(`${liveBase}/audio-worklet.js`);
    const source = audioContext.createMediaStreamSource(mediaStream);
    workletNode = new AudioWorkletNode(audioContext, "pcm16-capture");
    workletNode.port.onmessage = (event) => {
      if (!startAccepted || !$("consent").checked || $("inputKind").value !== "microphone_pcm16") return;
      $("micMeter").style.width = `${Math.min(100, Math.round((event.data.level || 0) * 300))}%`;
      if (socket?.readyState === WebSocket.OPEN) socket.send(event.data.buffer);
    };
    source.connect(workletNode);
    $("recordingIndicator").textContent = "Recording after consent";
  } catch (err) {
    log("events", `microphone error: ${err.message}`);
    await stopMic();
  }
}

async function stopMic() {
  startAccepted = false;
  workletNode?.disconnect();
  workletNode = null;
  if (audioContext) await audioContext.close().catch(() => undefined);
  audioContext = null;
  for (const track of mediaStream?.getTracks() || []) track.stop();
  mediaStream = null;
  $("micMeter").style.width = "0%";
  $("recordingIndicator").textContent = "Not recording";
}

function speak(instruction) {
  currentSpeechId = instruction.speechId;
  $("speechStatus").textContent = `${instruction.delivery} ${instruction.speechId}`;
  log("assistant", `client TTS instruction: ${instruction.text}`);
  if (ttsMuted || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(instruction.text);
  utterance.onend = () => {
    if (currentSpeechId === instruction.speechId) {
      currentSpeechId = "";
      $("speechStatus").textContent = "-";
    }
  };
  speechSynthesis.speak(utterance);
}

async function refreshProviders() {
  try {
    const response = await fetch("/providers");
    const body = await response.json();
    $("asrStatus").textContent = `${body.asr.selected} configured=${body.asr.deepgramConfigured}`;
    $("llmStatus").textContent = body.backend?.llm ? `${body.backend.llm.selected} configured=${body.backend.llm.configured}` : "unknown";
    $("outputStatus").textContent = body.output.strategy;
  } catch {
    $("asrStatus").textContent = "unreachable";
  }
}

function log(id, text) {
  const el = $(id);
  el.textContent += `[${new Date().toLocaleTimeString()}] ${text}\n`;
  el.scrollTop = el.scrollHeight;
}

function guessBackendUrl() {
  const url = new URL(window.location.href);
  if (url.hostname.startsWith("voice.")) return `${url.protocol}//api.${url.hostname.slice("voice.".length)}`;
  if (url.port === "3010" || url.port === "3013" || url.port === "3014") return `${url.protocol}//${url.hostname}:3000`;
  return "http://127.0.0.1:3000";
}
