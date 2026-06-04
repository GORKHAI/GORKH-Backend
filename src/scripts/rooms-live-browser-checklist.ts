import { config } from "../config.js";
import { roomConfigStatus } from "../rooms/policy.js";

const status = roomConfigStatus();
const gatewayBase = config.ROOMS_PUBLIC_BASE_URL ?? "https://voice.gorkh.com";

console.log(`Nearmind Rooms LiveKit browser checklist

Configuration:
- rooms enabled: ${status.enabled}
- LiveKit configured: ${status.configured}
- gateway/base URL: ${gatewayBase}
- recording enabled: ${status.recordingEnabled}
- AI agent enabled: ${status.aiAgentEnabled}
- AI speaking enabled: ${status.aiSpeakingEnabled}

Manual browser test:
1. Open the protected Brain Console or ops console.
2. Create a Nearmind Room.
3. Create a guest link.
4. Open the host room page: ${gatewayBase.replace(/\/$/, "")}/rooms/ui/<roomId>
5. Open the guest link in a private window or second browser: ${gatewayBase.replace(/\/$/, "")}/r/<inviteToken>
6. On the host page, paste a host JWT, click Load Room, tick consent, then Join LiveKit Room.
7. On the guest page, enter display name/email, tick consent, Grant Guest Consent, then Join LiveKit Room.
8. Verify both sides see local video, remote video, participant changes, and hear audio.
9. Verify Leave stops camera/microphone indicators on both sides.
10. Verify transcript add is denied before guest consent and allowed after consent.
11. Generate summary after transcript and confirm only a draft follow-up action proposal is created.
12. Confirm no LiveKit API secret appears in browser network responses.
13. Confirm there is no recording button and AI does not speak into the room.

This command does not claim media join success. Browser camera/audio must be checked manually.
`);

if (!status.enabled || !status.configured) {
  console.log("Status: rooms_not_configured. Configure ROOMS_ENABLED, LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET before real media testing.");
}
