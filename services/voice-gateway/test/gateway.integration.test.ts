import "dotenv/config";
import pg from "pg";
import { createClient } from "redis";
import WebSocket from "ws";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgres://gorkh:gorkh_dev_password@127.0.0.1:5432/gorkh_backend";
process.env.REDIS_URL ??= "redis://127.0.0.1:6379";
process.env.JWT_SECRET ??= "integration-test-secret-that-is-long-enough";
process.env.HOST = "127.0.0.1";
process.env.PORT = "3001";
process.env.VOICE_GATEWAY_HOST = "127.0.0.1";
process.env.VOICE_GATEWAY_PORT = "3011";
process.env.VOICE_GATEWAY_ASR_PROVIDER = "none";
process.env.VOICE_GATEWAY_OUTPUT_STRATEGY = "client_tts";
process.env.LLM_PROVIDER = "deepseek";
process.env.ANTHROPIC_API_KEY = "";
process.env.DEEPSEEK_API_KEY = "";
process.env.DEEPGRAM_API_KEY = "";
process.env.VOYAGE_API_KEY = "";

const { Pool } = pg;

let modules: Awaited<ReturnType<typeof loadBackendModules>> & Awaited<ReturnType<typeof loadGatewayModules>>;
let backendApp: Awaited<ReturnType<Awaited<ReturnType<typeof loadBackendModules>>["buildServer"]>>;
let gatewayApp: Awaited<ReturnType<Awaited<ReturnType<typeof loadGatewayModules>>["buildGatewayServer"]>>;
let backendHttp = "";
let gatewayHttp = "";
let gatewayWs = "";

beforeAll(async () => {
  await assertInfra();
  const backendModules = await loadBackendModules();
  modules = backendModules as typeof modules;
  await modules.runMigration();
  backendApp = await modules.buildServer();
  await backendApp.listen({ host: "127.0.0.1", port: 0 });
  const backendAddress = backendApp.server.address();
  if (!backendAddress || typeof backendAddress === "string") throw new Error("backend did not expose a TCP address");
  backendHttp = `http://127.0.0.1:${backendAddress.port}`;
  process.env.GORKH_BACKEND_HTTP_URL = backendHttp;
  process.env.GORKH_BACKEND_WS_URL = `ws://127.0.0.1:${backendAddress.port}`;
  const gatewayModules = await loadGatewayModules();
  modules = { ...backendModules, ...gatewayModules };
  gatewayApp = await modules.buildGatewayServer();
  await gatewayApp.listen({ host: "127.0.0.1", port: 0 });
  const gatewayAddress = gatewayApp.server.address();
  if (!gatewayAddress || typeof gatewayAddress === "string") throw new Error("gateway did not expose a TCP address");
  gatewayHttp = `http://127.0.0.1:${gatewayAddress.port}`;
  gatewayWs = `ws://127.0.0.1:${gatewayAddress.port}`;
});

afterAll(async () => {
  modules?.clearGatewaySessionsForTest();
  await cleanData().catch(() => undefined);
  await gatewayApp?.close();
  await backendApp?.close();
  await modules?.closeRedis?.();
  await modules?.closeDb?.();
});

beforeEach(async () => {
  modules?.clearGatewaySessionsForTest();
  await cleanData();
});

describe("gateway health and providers", () => {
  it("reports backend health and provider strategy", async () => {
    const health = await gatewayApp.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ ok: true, backend: true, asrProvider: "none", outputStrategy: "client_tts" });
    const providers = await gatewayApp.inject({ method: "GET", url: "/providers" });
    expect(providers.statusCode).toBe(200);
    expect(providers.json()).toMatchObject({
      asr: { selected: "none", available: false, deepgramConfigured: false },
      output: { strategy: "client_tts", audioGeneratedByGateway: false },
      backend: { llm: { selected: "deepseek", configured: false } },
    });
  });

  it("serves the live dev page outside production", async () => {
    const response = await gatewayApp.inject({ method: "GET", url: "/dev/live" });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("Live Voice Dev Console");
  });

  it("serves the Brain Console dev page outside production", async () => {
    const response = await gatewayApp.inject({ method: "GET", url: "/dev/brain" });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("GORKH Brain Console");
  });
});

describe("gateway websocket integration", () => {
  it("rejects missing and invalid auth", async () => {
    const { ws: missing, events: missingEvents } = await openRawWsWithEvents(`${gatewayWs}/gateway/voice`);
    await waitForEvent(missingEvents, "gateway_error");
    missing.close();
    expect(missingEvents.items).toContainEqual(expect.objectContaining({ type: "gateway_error", stage: "auth" }));

    const { ws: invalid, events: invalidEvents } = await openRawWsWithEvents(`${gatewayWs}/gateway/voice?token=bad-token`);
    await waitForEvent(invalidEvents, "gateway_error");
    invalid.close();
    expect(invalidEvents.items).toContainEqual(expect.objectContaining({ type: "gateway_error", stage: "auth" }));
  });

  it("runs text prep bank through backend and client-side TTS contract", async () => {
    const user = await devUser("gw-prep-bank@example.com");
    const { ws, events } = await openGateway(user.token);
    ws.send(JSON.stringify(startMessage({ policy: "conversation_agent", situationDescription: "I am going to the bank to discuss a loan" })));
    await waitForEvent(events, "gateway_ack");
    ws.send(JSON.stringify({ type: "user_text", text: "What should I ask before this bank loan meeting?" }));
    await waitForEvent(events, "voice_assistant_text");
    await waitForEvent(events, "voice_speak_request");
    await waitForEvent(events, "gateway_client_tts_instruction");
    ws.send(JSON.stringify({ type: "stop", save: false }));
    await delay(400);
    ws.close();
  });

  it("keeps deterministic paths working while missing DeepSeek reports provider_not_configured for open-ended chat", async () => {
    const user = await devUser("gw-missing-llm@example.com");
    const { ws, events } = await openGateway(user.token);
    ws.send(JSON.stringify(startMessage({ policy: "conversation_agent", situationDescription: "I am going to the bank to discuss a loan" })));
    await waitForEvent(events, "gateway_ack");
    ws.send(JSON.stringify({ type: "user_text", text: "Write a general negotiation strategy for my meeting." }));
    const error = await waitForEvent(events, "error");
    ws.send(JSON.stringify({ type: "stop", save: false }));
    ws.close();
    expect(error).toMatchObject({ type: "error", stage: "provider" });
    expect(String(error.message)).toContain("DEEPSEEK_API_KEY");
  });

  it("runs text whisper bank and discards backend session", async () => {
    const user = await devUser("gw-whisper-bank@example.com");
    const { ws, events } = await openGateway(user.token);
    ws.send(JSON.stringify(startMessage({ policy: "whisper_copilot", situationDescription: "I am talking with a bank about a loan", output: { kind: "text" } })));
    const ack = await waitForEvent(events, "gateway_ack");
    ws.send(JSON.stringify({ type: "transcript", speaker: "speaker_1", text: "The APR is 9.4 percent and there is also an arrangement fee.", offsetMs: 1200 }));
    await waitForEvent(events, "voice_cue");
    ws.send(JSON.stringify({ type: "stop", save: false }));
    await waitForStatus(String(ack.backendSessionId), "discarded");
    ws.close();
    const session = await getBackendSession(user.token, String(ack.backendSessionId));
    expect(session.status).toBe("discarded");
  });

  it("keeps doctor prep and whisper output safe", async () => {
    const user = await devUser("gw-doctor@example.com");
    const prep = await openGateway(user.token);
    prep.ws.send(JSON.stringify(startMessage({ policy: "conversation_agent", situationDescription: "I have a doctor appointment about blood test results" })));
    await waitForEvent(prep.events, "gateway_ack");
    prep.ws.send(JSON.stringify({ type: "user_text", text: "What should I ask my doctor about blood test results?" }));
    const assistant = await waitForEvent(prep.events, "voice_assistant_text");
    prep.ws.send(JSON.stringify({ type: "stop", save: false }));
    prep.ws.close();
    const assistantText = JSON.stringify(assistant).toLowerCase();
    expect(assistantText).toContain("do not diagnose");
    expect(assistantText).not.toMatch(/start treatment|take medication|change your medication to/);

    const whisper = await openGateway(user.token);
    whisper.ws.send(JSON.stringify(startMessage({ policy: "whisper_copilot", situationDescription: "I have a doctor appointment about blood test results" })));
    await waitForEvent(whisper.events, "gateway_ack");
    whisper.ws.send(JSON.stringify({ type: "transcript", speaker: "speaker_1", text: "We should discuss your blood test result and medication side effects.", offsetMs: 1000 }));
    const cue = await waitForEvent(whisper.events, "voice_cue");
    whisper.ws.send(JSON.stringify({ type: "stop", save: false }));
    whisper.ws.close();
    expect(JSON.stringify(cue).toLowerCase()).not.toMatch(/start treatment|take medication|change your medication to/);
  });

  it("rejects pcm16 when ASR provider is none without fake transcript or backend session", async () => {
    const user = await devUser("gw-pcm@example.com");
    const { ws, events } = await openGateway(user.token);
    ws.send(JSON.stringify(startMessage({ policy: "whisper_copilot", input: { kind: "pcm16", sampleRate: 16000, channels: 1 } })));
    await waitForEvent(events, "gateway_provider_error");
    ws.send(Buffer.alloc(320));
    await delay(100);
    ws.close();
    expect(events.items.some((event) => event.type === "gateway_asr_final" || event.type === "voice_ack")).toBe(false);
    expect(await tableCount("sessions", "status = 'active'")).toBe(0);
  });

  it("forwards barge-in cancellation", async () => {
    const user = await devUser("gw-barge@example.com");
    const { ws, events } = await openGateway(user.token);
    ws.send(JSON.stringify(startMessage({ policy: "conversation_agent", situationDescription: "I am going to the bank to discuss a loan" })));
    await waitForEvent(events, "gateway_ack");
    ws.send(JSON.stringify({ type: "user_text", text: "What should I ask before this bank loan meeting?" }));
    await waitForEvent(events, "voice_speak_request");
    ws.send(JSON.stringify({ type: "speech_started" }));
    await waitForEvent(events, "voice_cancel_speech");
    ws.send(JSON.stringify({ type: "stop", save: false }));
    ws.close();
  });

  it("marks backend interrupted on gateway disconnect without auto-save", async () => {
    const user = await devUser("gw-disconnect@example.com");
    const { ws, events } = await openGateway(user.token);
    ws.send(JSON.stringify(startMessage({ policy: "conversation_agent", situationDescription: "business meeting" })));
    const ack = await waitForEvent(events, "gateway_ack");
    ws.close();
    await waitForStatus(String(ack.backendSessionId), "interrupted");
    const session = await getBackendSession(user.token, String(ack.backendSessionId));
    expect(session.status).toBe("interrupted");
  });

  it("enforces ownership on gateway session debug endpoint", async () => {
    const userA = await devUser("gw-owner-a@example.com");
    const userB = await devUser("gw-owner-b@example.com");
    const { ws, events } = await openGateway(userA.token);
    ws.send(JSON.stringify(startMessage({ policy: "conversation_agent", situationDescription: "business meeting" })));
    const ack = await waitForEvent(events, "gateway_ack");
    const own = await fetch(`${gatewayHttp}/sessions/${ack.gatewaySessionId}`, { headers: auth(userA.token) });
    const blocked = await fetch(`${gatewayHttp}/sessions/${ack.gatewaySessionId}`, { headers: auth(userB.token) });
    ws.send(JSON.stringify({ type: "stop", save: false }));
    ws.close();
    expect(own.status).toBe(200);
    expect(blocked.status).toBe(404);
  });
});

async function loadBackendModules() {
  const [{ buildServer }, { runMigration }, dbClient, redisModule] = await Promise.all([
    import("../../../src/server.js"),
    import("../../../src/scripts/migrate.js"),
    import("../../../src/db/client.js"),
    import("../../../src/redis.js"),
  ]);
  return {
    buildServer,
    runMigration,
    closeDb: dbClient.closeDb,
    closeRedis: redisModule.closeRedis,
  };
}

async function loadGatewayModules() {
  const [{ buildGatewayServer }, gatewaySession] = await Promise.all([import("../src/server.js"), import("../src/session.js")]);
  return {
    buildGatewayServer,
    clearGatewaySessionsForTest: gatewaySession.clearGatewaySessionsForTest,
  };
}

async function assertInfra(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    throw new Error(`Integration tests require Postgres and Redis. Run npm run setup:local. Postgres error: ${(err as Error).message}`);
  } finally {
    await pool.end().catch(() => undefined);
  }
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { checkRedis } = await import("../../../src/redis.js");
    if (!(await checkRedis())) {
      throw new Error("Integration tests require Redis or Upstash REST. Run npm run setup:local.");
    }
  } else {
    const redis = createClient({ url: process.env.REDIS_URL });
    try {
      await redis.connect();
      await redis.ping();
    } catch (err) {
      throw new Error(`Integration tests require Postgres and Redis. Run npm run setup:local. Redis error: ${(err as Error).message}`);
    } finally {
      await redis.quit().catch(() => undefined);
    }
  }
}

async function cleanData(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await pool.query("SET lock_timeout = '5s'");
        await pool.query(
          "TRUNCATE consent_events, transcript_segments, suggestions, cue_events, agent_turns, voice_outputs, voice_sessions, memories, sessions, situation_briefs, users RESTART IDENTITY CASCADE",
        );
        return;
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code !== "40P01" || attempt === 2) {
          throw err;
        }
        await delay(100 * (attempt + 1));
      }
    }
  } finally {
    await pool.end();
  }
}

async function devUser(email: string): Promise<{ token: string; user: { id: string; email: string } }> {
  const response = await fetch(`${backendHttp}/dev/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, displayName: "Gateway Test" }),
  });
  if (!response.ok) throw new Error(`dev user failed: ${response.status} ${await response.text()}`);
  return (await response.json()) as { token: string; user: { id: string; email: string } };
}

async function openGateway(token: string): Promise<{ ws: WebSocket; events: ReturnType<typeof collectEvents> }> {
  const ws = await openRawWs(`${gatewayWs}/gateway/voice?token=${encodeURIComponent(token)}`);
  return { ws, events: collectEvents(ws) };
}

function openRawWs(url: string): Promise<WebSocket> {
  const ws = new WebSocket(url);
  return new Promise((resolve, reject) => {
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

async function openRawWsWithEvents(url: string): Promise<{ ws: WebSocket; events: ReturnType<typeof collectEvents> }> {
  const ws = new WebSocket(url);
  const events = collectEvents(ws);
  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  return { ws, events };
}

function collectEvents(ws: WebSocket): { items: Array<{ type: string; [key: string]: unknown }> } {
  const events: { items: Array<{ type: string; [key: string]: unknown }> } = { items: [] };
  ws.on("message", (data) => events.items.push(JSON.parse(data.toString()) as { type: string; [key: string]: unknown }));
  return events;
}

async function waitForEvent(events: { items: Array<{ type: string; [key: string]: unknown }> }, type: string, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const event = events.items.find((item) => item.type === type);
    if (event) return event;
    await delay(25);
  }
  throw new Error(`timed out waiting for ${type}; saw ${events.items.map((event) => event.type).join(", ")}`);
}

async function waitForStatus(sessionId: string, status: string): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const result = await pool.query("SELECT status FROM sessions WHERE id = $1", [sessionId]);
      if (result.rows[0]?.status === status) return;
      await delay(50);
    }
    throw new Error(`timed out waiting for ${sessionId} to become ${status}`);
  } finally {
    await pool.end();
  }
}

async function getBackendSession(token: string, sessionId: string): Promise<{ status: string }> {
  const response = await fetch(`${backendHttp}/sessions/${sessionId}`, { headers: auth(token) });
  if (!response.ok) throw new Error(`session fetch failed: ${response.status} ${await response.text()}`);
  return (await response.json()) as { status: string };
}

async function tableCount(table: string, where = "true"): Promise<number> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query(`SELECT count(*)::int AS count FROM ${table} WHERE ${where}`);
    return Number(result.rows[0]?.count ?? 0);
  } finally {
    await pool.end();
  }
}

function startMessage(overrides: Record<string, unknown> = {}) {
  return {
    type: "start",
    policy: "conversation_agent",
    situationDescription: "I am going to the bank to discuss a loan",
    title: "Gateway Session",
    consent: {
      granted: true,
      method: "user_tap",
      noticeText: "Live Assist is active. I confirm I have the right consent for this conversation.",
      participantCount: 1,
      jurisdiction: "unknown",
    },
    input: { kind: "text" },
    output: { kind: "both" },
    retentionPolicy: "ask_on_stop",
    ...overrides,
  };
}

function auth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
