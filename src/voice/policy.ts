import { config } from "../config.js";
import type { Cue } from "../cue/fast-cues.js";
import type { VoicePolicy } from "./types.js";

export function enforceSpokenWordLimit(text: string, maxWords = config.VOICE_MAX_SPOKEN_WORDS): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? text.trim() : words.slice(0, maxWords).join(" ");
}

export function enforceCueForPolicy(cue: Cue, policy: VoicePolicy): Cue {
  const spokenCue = enforceSpokenWordLimit(cue.spokenCue);
  if (policy === "conversation_agent") return { ...cue, spokenCue };
  const delivery = decideDelivery(cue, policy);
  return {
    ...cue,
    spokenCue,
    visualCue: cue.visualCue.slice(0, 180),
    delivery,
  };
}

export function prepareAssistantTextForPolicy(text: string, policy: VoicePolicy): string {
  if (policy === "conversation_agent") return text.slice(0, config.VOICE_AGENT_RESPONSE_MAX_CHARS);
  return enforceSpokenWordLimit(text);
}

export function canSpeakAssistantText(policy: VoicePolicy, text: string): boolean {
  if (policy === "conversation_agent") return true;
  return text.trim().split(/\s+/).filter(Boolean).length <= config.VOICE_MAX_SPOKEN_WORDS;
}

export function decideDelivery(cue: Pick<Cue, "urgency" | "delivery">, policy: VoicePolicy): Cue["delivery"] {
  if (policy === "conversation_agent") return cue.delivery === "silent" ? "screen" : cue.delivery;
  if (cue.urgency === "high") return cue.delivery === "silent" ? "earbud" : cue.delivery;
  if (cue.delivery === "earbud") return "screen";
  return cue.delivery;
}

export function shouldEmitCue(lastCueAt: number | null, now = Date.now()): boolean {
  return lastCueAt === null || now - lastCueAt >= config.VOICE_CUE_MIN_INTERVAL_MS;
}
