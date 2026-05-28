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

  app.get("/ops/live", async (request, reply) => {
    if (!(await requireOpsConsole(request, reply))) return;
    const html = await readPublicFile("live.html");
    return reply
      .type("text/html; charset=utf-8")
      .header("Cache-Control", "no-store")
      .send(toOpsHtml(html.replace("Live Voice Dev Console", "Protected Live Voice Ops Console"), "live"));
  });
  app.get("/ops/live/live-client.js", async (request, reply) => {
    if (!(await requireOpsConsole(request, reply))) return;
    return reply.type("text/javascript; charset=utf-8").header("Cache-Control", "no-store").send(await readPublicFile("live-client.js"));
  });
  app.get("/ops/live/audio-worklet.js", async (request, reply) => {
    if (!(await requireOpsConsole(request, reply))) return;
    return reply.type("text/javascript; charset=utf-8").header("Cache-Control", "no-store").send(await readPublicFile("audio-worklet.js"));
  });
  app.get("/ops/live/styles.css", async (request, reply) => {
    if (!(await requireOpsConsole(request, reply))) return;
    return reply.type("text/css; charset=utf-8").header("Cache-Control", "no-store").send(await readPublicFile("styles.css"));
  });
  app.get("/ops/brain", async (request, reply) => {
    if (!(await requireOpsConsole(request, reply))) return;
    const html = await readPublicFile("brain-console.html");
    return reply
      .type("text/html; charset=utf-8")
      .header("Cache-Control", "no-store")
      .send(toOpsHtml(html.replace("GORKH Brain Console", "Protected GORKH Brain Ops Console"), "brain"));
  });
  app.get("/ops/brain/brain-console.js", async (request, reply) => {
    if (!(await requireOpsConsole(request, reply))) return;
    return reply.type("text/javascript; charset=utf-8").header("Cache-Control", "no-store").send(await readPublicFile("brain-console.js"));
  });
  app.get("/ops/brain/brain-console.css", async (request, reply) => {
    if (!(await requireOpsConsole(request, reply))) return;
    return reply.type("text/css; charset=utf-8").header("Cache-Control", "no-store").send(await readPublicFile("brain-console.css"));
  });

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
  const contents = await readPublicFile(fileName);
  return reply.type(contentType).send(contents);
}

async function readPublicFile(fileName: string): Promise<string> {
  const candidates = [
    new URL(`../public/${fileName}`, import.meta.url),
    new URL(`../../../../services/voice-gateway/public/${fileName}`, import.meta.url),
  ];
  let lastError: unknown;
  for (const fileUrl of candidates) {
    try {
      return await readFile(fileUrl, "utf8");
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`failed to read gateway public file ${fileName}`);
}

async function requireOpsConsole(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  if (!gatewayConfig.OPS_CONSOLE_ENABLED || !gatewayConfig.OPS_CONSOLE_ADMIN_TOKEN) {
    reply.code(404).send({ error: "not found" });
    return false;
  }
  const query = request.query as { token?: string } | undefined;
  if (query?.token === gatewayConfig.OPS_CONSOLE_ADMIN_TOKEN) {
    setOpsCookie(reply, gatewayConfig.OPS_CONSOLE_ADMIN_TOKEN);
    const cleanUrl = request.url.replace(/[?&]token=[^&]+/, "").replace(/[?&]$/, "");
    reply.redirect(cleanUrl || request.url.split("?")[0] || "/ops/live");
    return false;
  }
  if (isOpsAuthorized(request)) return true;
  reply.code(401).send({ error: "missing or invalid ops token" });
  return false;
}

function isOpsAuthorized(request: FastifyRequest): boolean {
  const expected = gatewayConfig.OPS_CONSOLE_ADMIN_TOKEN;
  if (!expected) return false;
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ") && header.slice("Bearer ".length).trim() === expected) return true;
  const cookie = parseCookie(request.headers.cookie ?? "").gorkh_ops;
  return cookie === expected;
}

function setOpsCookie(reply: FastifyReply, token: string): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  reply.header(
    "Set-Cookie",
    `gorkh_ops=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/ops; Max-Age=${gatewayConfig.OPS_CONSOLE_SESSION_TTL_SECONDS}${secure}`,
  );
}

function parseCookie(header: string): Record<string, string> {
  const entries = header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf("=");
      return index === -1 ? [part, ""] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    });
  return Object.fromEntries(entries);
}

function toOpsHtml(html: string, consoleName: "live" | "brain"): string {
  const prefix = `/ops/${consoleName}`;
  return html
    .replaceAll(`/dev/${consoleName}`, prefix)
    .replace(
      "<body>",
      '<body><div style="background:#7f1d1d;color:white;padding:10px 16px;font:14px system-ui">Protected staging/ops console. Do not expose publicly.</div>',
    );
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
