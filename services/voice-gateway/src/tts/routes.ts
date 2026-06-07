import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { tokenFromRequest, verifyGatewayToken } from "../auth.js";
import { gatewayConfig, isNaturalVoiceConfigured } from "../config.js";
import { DeepgramAuraTtsProvider } from "./deepgram-aura.js";
import { NoneTtsProvider } from "./none.js";
import type { TtsProvider } from "./provider.js";
import { validateTtsInput } from "./safety.js";
import { getVoiceCharacters } from "./characters.js";
import { TtsProviderError, ttsPurposes, voiceCharacterIds, type TtsPurpose, type VoiceCharacterId } from "./types.js";

const synthesizeSchema = z.object({
  text: z.string().min(1),
  speechId: z.string().min(1).optional(),
  voiceCharacterId: z.enum(voiceCharacterIds).default("calm_guide"),
  purpose: z.enum(ttsPurposes).default("assistant_response"),
  outputFormat: z.enum(["audio/mpeg", "audio/wav"]).default("audio/mpeg"),
  deliveryTarget: z.string().optional(),
  sessionId: z.string().optional(),
});

export function registerTtsRoutes(app: FastifyInstance): void {
  app.post("/tts/synthesize", async (request, reply) => {
    const userId = await requireTtsAuth(request, reply);
    if (!userId) return;

    if (!gatewayConfig.NATURAL_VOICE_ENABLED) {
      return sendTtsError(reply, new TtsProviderError("natural_voice_disabled", "Natural Voice is disabled.", false, 403));
    }

    try {
      const body = synthesizeSchema.parse(request.body);
      validateTtsInput({
        text: body.text,
        speechId: body.speechId,
        voiceCharacterId: body.voiceCharacterId as VoiceCharacterId,
        purpose: body.purpose as TtsPurpose,
        outputFormat: body.outputFormat,
        deliveryTarget: body.deliveryTarget,
        userId,
        sessionId: body.sessionId,
      });
      const provider = makeTtsProvider();
      const result = await provider.synthesize({
        text: body.text,
        speechId: body.speechId,
        voiceCharacterId: body.voiceCharacterId as VoiceCharacterId,
        purpose: body.purpose as TtsPurpose,
        outputFormat: body.outputFormat,
        userId,
        sessionId: body.sessionId,
      });
      return reply
        .header("X-NearMind-TTS-Provider", result.provider)
        .header("X-NearMind-Voice-Character", result.voiceCharacterId)
        .header("X-NearMind-TTS-Latency-Ms", String(result.latencyMs))
        .type(result.contentType)
        .send(result.audioBuffer);
    } catch (error) {
      if (error instanceof TtsProviderError) return sendTtsError(reply, error);
      if (error instanceof z.ZodError) {
        return sendTtsError(reply, new TtsProviderError("tts_invalid_request", "Invalid Natural Voice request.", false, 400));
      }
      return sendTtsError(reply, new TtsProviderError("tts_provider_error", "Natural Voice synthesis failed.", true, 502));
    }
  });
}

export function ttsProviderStatus() {
  return {
    naturalVoiceEnabled: gatewayConfig.NATURAL_VOICE_ENABLED,
    selectedProvider: gatewayConfig.TTS_PROVIDER,
    configured: isNaturalVoiceConfigured(),
    audioStoredByDefault: false,
    cacheEnabled: gatewayConfig.TTS_CACHE_ENABLED,
    characters: getVoiceCharacters().map((character) => ({
      id: character.id,
      displayName: character.displayName,
      description: character.description,
      useCase: character.useCase,
      riskNotes: character.riskNotes,
      maxSpokenWords: character.maxSpokenWords,
      allowedForWhisper: character.allowedForWhisper,
      allowedForStressSupport: character.allowedForStressSupport,
      configured: Boolean(character.providerVoiceId),
    })),
  };
}

function makeTtsProvider(): TtsProvider {
  if (gatewayConfig.TTS_PROVIDER === "deepgram_aura") return new DeepgramAuraTtsProvider();
  return new NoneTtsProvider();
}

async function requireTtsAuth(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
  const token = tokenFromRequest(request);
  if (!token) {
    reply.code(401).send({ code: "auth_missing", message: "Missing bearer token.", retryable: false });
    return null;
  }
  try {
    const { userId } = await verifyGatewayToken(token);
    return userId;
  } catch {
    reply.code(401).send({ code: "auth_invalid", message: "Invalid bearer token.", retryable: false });
    return null;
  }
}

function sendTtsError(reply: FastifyReply, error: TtsProviderError) {
  return reply.code(error.statusCode).send(error.toBody());
}
