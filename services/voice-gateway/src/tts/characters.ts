import { gatewayConfig } from "../config.js";
import type { VoiceCharacter, VoiceCharacterId } from "./types.js";

export function getVoiceCharacters(): VoiceCharacter[] {
  return [
    {
      id: "calm_guide",
      displayName: "Calm Guide",
      description: "Calm, neutral, clear voice for daily assistant responses.",
      useCase: "Default general assistant and everyday chat.",
      riskNotes: "Product preset only; not a real person or cloned voice.",
      providerVoiceId: gatewayConfig.DEEPGRAM_TTS_VOICE_CALM,
      maxSpokenWords: 90,
      allowedForWhisper: false,
      allowedForStressSupport: true,
    },
    {
      id: "professional",
      displayName: "Professional",
      description: "Confident and business-like voice for work contexts.",
      useCase: "Meetings, investor calls, role preparation, and work summaries.",
      riskNotes: "Must not imply authority beyond assistant guidance.",
      providerVoiceId: gatewayConfig.DEEPGRAM_TTS_VOICE_PROFESSIONAL,
      maxSpokenWords: 90,
      allowedForWhisper: false,
      allowedForStressSupport: false,
    },
    {
      id: "warm_support",
      displayName: "Warm Support",
      description: "Softer, reassuring voice for stressful moments.",
      useCase: "Grounding and supportive assistant responses.",
      riskNotes: "Must not sound therapeutic, diagnostic, or manipulative.",
      providerVoiceId: gatewayConfig.DEEPGRAM_TTS_VOICE_WARM,
      maxSpokenWords: 75,
      allowedForWhisper: false,
      allowedForStressSupport: true,
    },
    {
      id: "focus_whisper",
      displayName: "Focus Whisper",
      description: "Short, low-distraction voice for private cues.",
      useCase: "Whisper Copilot cues during real-life moments.",
      riskNotes: "Never for long reports or screen-only content.",
      providerVoiceId: gatewayConfig.DEEPGRAM_TTS_VOICE_WHISPER,
      maxSpokenWords: 18,
      allowedForWhisper: true,
      allowedForStressSupport: false,
    },
    {
      id: "briefing_voice",
      displayName: "Briefing Voice",
      description: "Crisp and structured voice for summaries and tasks.",
      useCase: "Daily brief, task review, and concise status summaries.",
      riskNotes: "Avoid long-form narration in beta.",
      providerVoiceId: gatewayConfig.DEEPGRAM_TTS_VOICE_BRIEFING,
      maxSpokenWords: 120,
      allowedForWhisper: false,
      allowedForStressSupport: false,
    },
  ];
}

export function getVoiceCharacter(id: VoiceCharacterId): VoiceCharacter | undefined {
  return getVoiceCharacters().find((character) => character.id === id);
}
