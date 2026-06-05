import { RelayPolicyError } from "./policy.js";
import { safeRequestForUser } from "./safety.js";
import { createRelayDraft } from "./service.js";
import { detectRelayIntent } from "./chat-intent.js";

export async function answerRelayChatIntent(userId: string, text: string) {
  const intent = detectRelayIntent(text);
  if (!intent) return null;
  if (intent.teamOrBroadcast) {
    return {
      status: "answered",
      answer: "Team Relay and broadcast requests are future workspace features. NearMind Relay v0 supports one specific recipient at a time.",
      usedProfileContext: false,
      researchNeed: noResearchNeed(),
    };
  }
  if (!intent.recipient.displayName && !intent.recipient.email) {
    return {
      status: "answered",
      answer: "Who should I ask? Add a recipient name or email and I can draft a Relay request for your approval.",
      usedProfileContext: false,
      researchNeed: noResearchNeed(),
    };
  }

  try {
    const request = await createRelayDraft(userId, {
      requestType: intent.requestType,
      recipient: intent.recipient,
      goal: intent.goal,
      context: { source: "brain_query_relay_intent" },
    });
    return {
      status: "answered",
      answer: "I drafted a private Relay request. Review it before sending.",
      usedProfileContext: false,
      researchNeed: noResearchNeed(),
      card: {
        type: "relay_request_approval",
        requestId: request.id,
        title: request.title,
        summary: safeRequestForUser(request, userId).summary,
        confirmLabel: "Send Request",
        cancelLabel: "Cancel",
      },
    };
  } catch (err) {
    if (err instanceof RelayPolicyError) {
      return {
        status: "answered",
        answer: err.message,
        usedProfileContext: false,
        researchNeed: noResearchNeed(),
      };
    }
    throw err;
  }
}

function noResearchNeed() {
  return {
    needsResearch: false,
    urgency: "none",
    suggestedQuery: null,
    researchKind: "none",
  };
}
