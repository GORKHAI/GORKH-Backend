import websocket from "@fastify/websocket";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { tokenFromRequest, verifyGatewayToken } from "./auth.js";
import { gatewayConfig, isAsrAvailable, validateGatewayBootConfig } from "./config.js";
import { getGatewaySessionForUser } from "./session.js";
import { attachGatewayVoiceSocket } from "./transport/websocket.js";

export async function buildGatewayServer() {
  validateGatewayBootConfig();
  const app = Fastify({ logger: true });
  await app.register(websocket);

  app.get("/health", async () => {
    const backend = await checkBackendHealth();
    const providerOk = gatewayConfig.VOICE_GATEWAY_ASR_PROVIDER !== "deepgram" || Boolean(gatewayConfig.DEEPGRAM_API_KEY);
    return {
      ok: backend && providerOk,
      backend,
      asrProvider: gatewayConfig.VOICE_GATEWAY_ASR_PROVIDER,
      outputStrategy: gatewayConfig.VOICE_GATEWAY_OUTPUT_STRATEGY,
    };
  });

  app.get("/providers", async () => {
    const backendHealth = await readBackendHealth();
    return {
      asr: {
        selected: gatewayConfig.VOICE_GATEWAY_ASR_PROVIDER,
        available: isAsrAvailable(),
        deepgramConfigured: Boolean(gatewayConfig.DEEPGRAM_API_KEY),
      },
      output: {
        strategy: gatewayConfig.VOICE_GATEWAY_OUTPUT_STRATEGY,
        audioGeneratedByGateway: false,
      },
      backend: {
        llm: backendHealth?.providers?.llm ?? null,
      },
    };
  });

  if (process.env.NODE_ENV !== "production") {
    app.get("/dev/live", async (_, reply) => sendPublicFile(reply, "live.html", "text/html; charset=utf-8"));
    app.get("/dev/live/live-client.js", async (_, reply) => sendPublicFile(reply, "live-client.js", "text/javascript; charset=utf-8"));
    app.get("/dev/live/audio-worklet.js", async (_, reply) => sendPublicFile(reply, "audio-worklet.js", "text/javascript; charset=utf-8"));
    app.get("/dev/live/styles.css", async (_, reply) => sendPublicFile(reply, "styles.css", "text/css; charset=utf-8"));
    app.get("/dev/brain", async (_, reply) => sendPublicFile(reply, "brain-console.html", "text/html; charset=utf-8"));
    app.get("/dev/brain/brain-console.js", async (_, reply) => sendPublicFile(reply, "brain-console.js", "text/javascript; charset=utf-8"));
    app.get("/dev/brain/brain-console.css", async (_, reply) => sendPublicFile(reply, "brain-console.css", "text/css; charset=utf-8"));
  }

  app.get("/sessions/:gatewaySessionId", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const params = z.object({ gatewaySessionId: z.string().uuid() }).parse(request.params);
    const session = getGatewaySessionForUser(userId, params.gatewaySessionId);
    if (!session) return reply.code(404).send({ error: "not found" });
    return reply.send(session);
  });

  app.get("/gateway/voice", { websocket: true }, async (socket, request) => {
    try {
      const token = tokenFromRequest(request);
      if (!token) {
        socket.send(JSON.stringify({ type: "gateway_error", stage: "auth", message: "Missing or invalid token." }));
        socket.close();
        return;
      }
      const { userId } = await verifyGatewayToken(token);
      attachGatewayVoiceSocket(socket, userId, token);
    } catch {
      socket.send(JSON.stringify({ type: "gateway_error", stage: "auth", message: "Missing or invalid token." }));
      socket.close();
    }
  });

  return app;
}

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
  const token = tokenFromRequest(request);
  if (!token) {
    reply.code(401).send({ error: "missing bearer token" });
    return null;
  }
  try {
    const { userId } = await verifyGatewayToken(token);
    return userId;
  } catch {
    reply.code(401).send({ error: "invalid bearer token" });
    return null;
  }
}

async function checkBackendHealth(): Promise<boolean> {
  const body = await readBackendHealth();
  return body?.ok === true;
}

async function readBackendHealth(): Promise<{ ok?: boolean; providers?: { llm?: unknown } } | null> {
  try {
    const response = await fetch(`${gatewayConfig.GORKH_BACKEND_HTTP_URL.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    return (await response.json()) as { ok?: boolean; providers?: { llm?: unknown } };
  } catch {
    return null;
  }
}

async function sendPublicFile(reply: FastifyReply, fileName: string, contentType: string) {
  const fileUrl = new URL(`../public/${fileName}`, import.meta.url);
  const contents = await readFile(fileUrl);
  return reply.type(contentType).send(contents);
}

async function main(): Promise<void> {
  const app = await buildGatewayServer();
  await app.listen({ host: gatewayConfig.VOICE_GATEWAY_HOST, port: gatewayConfig.VOICE_GATEWAY_PORT });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
