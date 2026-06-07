import { readFileSync } from "node:fs";

interface EnvMap {
  [key: string]: string | undefined;
}

loadDotenvPath(process.env.DOTENV_CONFIG_PATH);

const env = process.env as EnvMap;
const gatewayUrl = (env.LIVE_GATEWAY_URL ?? "https://voice.gorkh.com").replace(/\/$/, "");
const token = env.LIVE_TEST_JWT ?? env.LIVE_TEST_JWT_A;

if (env.NATURAL_VOICE_ENABLED !== "true" || env.TTS_PROVIDER !== "deepgram_aura" || !env.DEEPGRAM_API_KEY) {
  console.log("tts:live:verify not_configured");
  process.exit(0);
}
if (!token) {
  console.log("tts:live:verify missing_live_test_jwt");
  process.exit(0);
}

const response = await fetch(`${gatewayUrl}/tts/synthesize`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "audio/mpeg",
  },
  body: JSON.stringify({
    text: "NearMind voice test.",
    speechId: "tts-live-verify",
    voiceCharacterId: "calm_guide",
    purpose: "assistant_response",
  }),
});

if (!response.ok) {
  const body = await response.text();
  console.log(`tts:live:verify failed status=${response.status} body=${redact(body)}`);
  process.exit(1);
}

const audio = Buffer.from(await response.arrayBuffer());
if (audio.byteLength <= 0) {
  console.log("tts:live:verify failed empty_audio");
  process.exit(1);
}

console.log(`tts:live:verify ok bytes=${audio.byteLength} provider=${response.headers.get("x-nearmind-tts-provider") ?? "unknown"}`);

function loadDotenvPath(path: string | undefined): void {
  if (!path) return;
  const contents = readFileSync(path, "utf8");
  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

function redact(text: string): string {
  return text.replace(/[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[redacted token]");
}
