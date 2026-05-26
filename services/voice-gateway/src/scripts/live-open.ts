import { gatewayConfig } from "../config.js";

const url = `http://127.0.0.1:${gatewayConfig.VOICE_GATEWAY_PORT}/dev/live`;

console.log(`Open the live dev console: ${url}`);
console.log("Required steps:");
console.log("1. Run backend: npm run dev");
console.log("2. Run gateway: npm run gateway:dev");
console.log("3. Open the forwarded gateway port in your browser.");
console.log("4. Click Create Dev User.");
console.log("5. Check consent, start a typed or microphone session, then speak a test phrase.");
console.log("Browser auto-open is not attempted from this Codespace script.");
