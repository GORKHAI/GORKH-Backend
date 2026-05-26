import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { stressEvents } from "../db/schema.js";
import { getOrCreateHumanProfile } from "../human/profile.js";
import { crisisResource } from "./crisis.js";
import { detectStressSignal } from "./detector.js";
import { assertStressSupportSafe } from "./safety.js";
import type { StressSupportResponse } from "./types.js";
import { logBrainAuditEvent } from "../brain/audit.js";

export async function generateStressSupport(args: {
  userId: string;
  text: string;
  sessionId?: string | null;
  locale?: string;
  allowTransientWithoutOptIn?: boolean;
}): Promise<StressSupportResponse> {
  const profile = await getOrCreateHumanProfile(args.userId);
  const decision = detectStressSignal(args.text);
  const optedIn = profile.stressSupportOptIn;
  let response: StressSupportResponse;

  if (decision.crisis) {
    const resource = crisisResource(args.locale);
    response = {
      supportType: "crisis_resource",
      content: `If you might hurt yourself or are in immediate danger, contact local emergency services now. You can also contact ${resource.name}: ${resource.description}. I am not an emergency service.`,
      status: "escalated",
      confidence: decision.confidence,
      crisisResource: resource,
    };
  } else if (!decision.detected && !args.allowTransientWithoutOptIn) {
    response = { supportType: "no_action", content: "No stress support signal detected.", status: "ignored", confidence: 0 };
  } else if (config.STRESS_SUPPORT_REQUIRE_OPT_IN && !optedIn && !args.allowTransientWithoutOptIn) {
    response = {
      supportType: "no_action",
      content: "Stress support storage requires opt-in. You can still ask for in-the-moment grounding without saving it.",
      status: "suppressed",
      confidence: decision.confidence,
    };
  } else {
    response = responseForSignal(decision.signal, decision.confidence);
  }

  assertStressSupportSafe(response.content);
  await db.insert(stressEvents).values({
    userId: args.userId,
    sessionId: args.sessionId ?? null,
    detectedSignal: decision.signal,
    supportType: response.supportType,
    confidence: response.confidence,
    userOptedIn: optedIn,
    content: optedIn || decision.crisis ? response.content : null,
    status: response.status,
  });
  await logBrainAuditEvent({
    userId: args.userId,
    sessionId: args.sessionId ?? null,
    eventType: "stress_support",
    payload: { supportType: response.supportType, status: response.status, userOptedIn: optedIn, storedContent: optedIn || decision.crisis },
  }).catch(() => null);
  return response;
}

export async function hasStressSupportOptIn(userId: string): Promise<boolean> {
  const profile = await getOrCreateHumanProfile(userId);
  return profile.stressSupportOptIn;
}

function responseForSignal(signal: string, confidence: number): StressSupportResponse {
  if (signal === "breathing_distress") {
    return { supportType: "breathing", content: "Take one slow breath. If breathing feels medically urgent, seek immediate local help.", status: "emitted", confidence };
  }
  if (signal === "overwhelm") {
    return { supportType: "pause", content: "Pause before responding. Ask for two minutes if you need space.", status: "emitted", confidence };
  }
  return { supportType: "grounding", content: "Name one concrete next step. Keep your next sentence short.", status: "emitted", confidence: Math.max(confidence, 0.6) };
}
