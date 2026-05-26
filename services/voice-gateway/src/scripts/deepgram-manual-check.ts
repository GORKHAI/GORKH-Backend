import { gatewayConfig } from "../config.js";

if (!gatewayConfig.DEEPGRAM_API_KEY) {
  console.log("gateway:deepgram:manual-check: Deepgram (DEEPGRAM_API_KEY) is not configured");
  process.exit(0);
}

console.log("gateway:deepgram:manual-check: Deepgram key is configured.");
console.log(`Open http://127.0.0.1:${gatewayConfig.VOICE_GATEWAY_PORT}/dev/live from a forwarded browser port.`);
console.log("Set input to microphone_pcm16, consent, start the session, and speak a phrase.");
console.log("This script does not claim transcription pass/fail unless a real browser microphone ASR final is observed manually.");
