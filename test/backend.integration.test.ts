import "dotenv/config";
import pg from "pg";
import { createClient } from "redis";
import WebSocket from "ws";
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgres://gorkh:gorkh_dev_password@127.0.0.1:5432/gorkh_backend";
process.env.REDIS_URL ??= "redis://127.0.0.1:6379";
process.env.JWT_SECRET ??= "integration-test-secret-that-is-long-enough";
process.env.HOST ??= "127.0.0.1";
process.env.PORT ??= "3001";
process.env.LLM_PROVIDER = "deepseek";
process.env.ANTHROPIC_API_KEY = "";
process.env.DEEPSEEK_API_KEY = "";
process.env.DEEPGRAM_API_KEY = "";
process.env.VOYAGE_API_KEY = "";

const { Pool } = pg;

let modules: Awaited<ReturnType<typeof loadModules>>;
let app: Awaited<ReturnType<Awaited<ReturnType<typeof loadModules>>["buildServer"]>>;
let baseUrl = "";
let wsUrl = "";

beforeAll(async () => {
  await assertInfra();
  modules = await loadModules();
  await modules.runMigration();
  app = await modules.buildServer();
  await app.listen({ host: "127.0.0.1", port: 0 });
  const address = app.server.address();
  if (!address || typeof address === "string") throw new Error("test server did not expose a TCP address");
  baseUrl = `http://127.0.0.1:${address.port}`;
  wsUrl = `ws://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  modules?.resetSessionJobOverridesForTest();
  modules?.resetVoiceAgentForTest();
  await cleanData().catch(() => undefined);
  await app?.close();
  await modules?.closeRedis?.();
  await modules?.closeDb?.();
});

beforeEach(async () => {
  modules?.resetSessionJobOverridesForTest();
  modules?.resetVoiceAgentForTest();
  await cleanData();
});

afterEach(async () => {
  modules?.resetSessionJobOverridesForTest();
  modules?.resetVoiceAgentForTest();
});

describe("integration infrastructure", () => {
  it("runs migration twice idempotently", async () => {
    await modules.runMigration();
    await modules.runMigration();
    const result = await modules.pool.query("SELECT to_regclass('public.memories_embedding_hnsw') AS idx");
    expect(result.rows[0]?.idx).toBe("memories_embedding_hnsw");
  });

  it("reports healthy and ready when DB and Redis are running", async () => {
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ ok: true, db: true, redis: true });
    const ready = await app.inject({ method: "GET", url: "/health/ready" });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toMatchObject({ ok: true, db: true, redis: true });
  });
});

describe("integration auth and situations", () => {
  it("creates a dev user and enforces JWT auth", async () => {
    const user = await devUser("it-auth@example.com");
    const ok = await app.inject({ method: "POST", url: "/situations", headers: auth(user.token), payload: { description: "business meeting" } });
    expect(ok.statusCode).toBe(200);
    const missing = await app.inject({ method: "POST", url: "/situations", payload: { description: "business meeting" } });
    expect(missing.statusCode).toBe(401);
    const invalid = await app.inject({ method: "POST", url: "/situations", headers: auth("bad-token"), payload: { description: "business meeting" } });
    expect(invalid.statusCode).toBe(401);
  });

  it("creates bank and doctor situations and enforces ownership", async () => {
    const userA = await devUser("it-situation-a@example.com");
    const userB = await devUser("it-situation-b@example.com");
    const bank = await createSituation(userA.token, "I am going to the bank to discuss a mortgage loan");
    const doctor = await createSituation(userA.token, "I have a doctor appointment about blood test results");
    expect(bank.situationBrief.inferredType).toBe("bank_loan");
    expect(doctor.situationBrief.inferredType).toBe("doctor_visit");
    const owned = await app.inject({ method: "GET", url: `/situations/${bank.situationBrief.id}`, headers: auth(userA.token) });
    expect(owned.statusCode).toBe(200);
    const blocked = await app.inject({ method: "GET", url: `/situations/${bank.situationBrief.id}`, headers: auth(userB.token) });
    expect(blocked.statusCode).toBe(404);
  });
});

describe("integration websocket safety flows", () => {
  it("rejects missing consent without creating an active session or transcript", async () => {
    const user = await devUser("it-consent@example.com");
    const ws = await openWs(user.token);
    const events = collectEvents(ws);
    ws.send(JSON.stringify(startMessage({ consentGranted: false, situationDescription: "bank loan", retentionPolicy: "ask_on_stop" })));
    await waitForEvent(events, "error");
    ws.close();
    await delay(100);
    expect(events.items.some((event) => event.type === "error" && event.stage === "consent")).toBe(true);
    expect(await tableCount("sessions", "status = 'active'")).toBe(0);
    expect(await tableCount("transcript_segments")).toBe(0);
  });

  it("starts a consented text session and records consent", async () => {
    const user = await devUser("it-start@example.com");
    const ws = await openWs(user.token);
    const events = collectEvents(ws);
    ws.send(JSON.stringify(startMessage({ situationDescription: "project meeting", retentionPolicy: "ask_on_stop" })));
    const ack = await waitForEvent(events, "ack");
    const consentCount = await tableCount("consent_events", "granted = true");
    const session = await getSession(user.token, String(ack.sessionId));
    ws.close();
    expect(consentCount).toBe(1);
    expect(session.status).toBe("active");
  });

  it("emits bank triggers and deterministic cue without Anthropic", async () => {
    const user = await devUser("it-bank@example.com");
    const situation = await createSituation(user.token, "I am going to the bank to discuss a mortgage loan");
    const ws = await openWs(user.token);
    const events = collectEvents(ws);
    ws.send(JSON.stringify(startMessage({ situationBriefId: situation.situationBrief.id })));
    await waitForEvent(events, "ack");
    ws.send(JSON.stringify({ type: "transcript", speaker: "speaker_1", text: "The APR is 9.4 percent and there is also an arrangement fee.", offsetMs: 1000 }));
    const cue = await waitForEvent(events, "cue");
    ws.send(JSON.stringify({ type: "stop", save: false }));
    await delay(250);
    ws.close();
    expect(events.items.some((event) => event.type === "segment")).toBe(true);
    expect(events.items.some((event) => event.type === "triggers")).toBe(true);
    expect(String((cue.cue as { spokenCue: string }).spokenCue).split(/\s+/).length).toBeLessThanOrEqual(8);
    expect(["earbud", "screen"]).toContain((cue.cue as { delivery: string }).delivery);
  });

  it("emits doctor-safe deterministic cue", async () => {
    const user = await devUser("it-doctor@example.com");
    const situation = await createSituation(user.token, "I have a doctor appointment about blood test results");
    const ws = await openWs(user.token);
    const events = collectEvents(ws);
    ws.send(JSON.stringify(startMessage({ situationBriefId: situation.situationBrief.id })));
    await waitForEvent(events, "ack");
    ws.send(JSON.stringify({ type: "transcript", speaker: "speaker_1", text: "We should discuss your blood test result and medication side effects.", offsetMs: 1000 }));
    const cue = await waitForEvent(events, "cue");
    ws.send(JSON.stringify({ type: "stop", save: false }));
    await delay(250);
    ws.close();
    const text = JSON.stringify(cue.cue).toLowerCase();
    expect(text).not.toMatch(/\bdiagnos|treatment recommendation|change medication\b/);
  });

  it("discards transcripts, cues, suggestions, and memories on save=false", async () => {
    const user = await devUser("it-discard@example.com");
    const sessionId = await runOneTranscript(user.token, "bank loan", "The APR is 9.4 percent and there is an arrangement fee.", "ask_on_stop", false);
    const session = await getSession(user.token, sessionId);
    expect(session.status).toBe("discarded");
    expect(session.counts).toMatchObject({ transcriptSegments: 0, suggestions: 0, cueEvents: 0 });
    expect(await tableCount("memories")).toBe(0);
  });

  it("marks disconnect as interrupted without summary or memory extraction", async () => {
    const user = await devUser("it-disconnect@example.com");
    const ws = await openWs(user.token);
    const events = collectEvents(ws);
    ws.send(JSON.stringify(startMessage({ situationDescription: "bank loan", retentionPolicy: "save_on_stop" })));
    const ack = await waitForEvent(events, "ack");
    ws.send(JSON.stringify({ type: "transcript", speaker: "speaker_1", text: "The APR is 9.4 percent.", offsetMs: 1000 }));
    await waitForEvent(events, "segment");
    ws.close();
    await waitForStatus(String(ack.sessionId), "interrupted");
    const session = await getSession(user.token, String(ack.sessionId));
    expect(session.status).toBe("interrupted");
    expect(events.items.some((event) => event.type === "summary")).toBe(false);
    expect(await tableCount("memories")).toBe(0);
  });

  it("enforces ownership on session debug endpoints", async () => {
    const userA = await devUser("it-owner-a@example.com");
    const userB = await devUser("it-owner-b@example.com");
    const situation = await createSituation(userA.token, "I am going to the bank to discuss a loan");
    const sessionId = await runOneTranscript(userA.token, "bank loan", "The APR is 9.4 percent.", "ask_on_stop", true, situation.situationBrief.id);
    const urls = [`/sessions/${sessionId}`, `/sessions/${sessionId}/transcript`, `/sessions/${sessionId}/cues`, `/sessions/${sessionId}/suggestions`, `/situations/${situation.situationBrief.id}`];
    for (const url of urls) {
      const response = await app.inject({ method: "GET", url, headers: auth(userB.token) });
      expect(response.statusCode).toBe(404);
    }
  });

  it("keeps deterministic cues when Anthropic is missing and does not fabricate suggestions", async () => {
    const user = await devUser("it-provider-missing@example.com");
    const ws = await openWs(user.token);
    const events = collectEvents(ws);
    ws.send(JSON.stringify(startMessage({ situationDescription: "bank loan", retentionPolicy: "ask_on_stop" })));
    const ack = await waitForEvent(events, "ack");
    ws.send(JSON.stringify({ type: "transcript", speaker: "speaker_1", text: "The APR is 9.4 percent.", offsetMs: 1000 }));
    await waitForEvent(events, "cue");
    await waitForEvent(events, "error");
    ws.send(JSON.stringify({ type: "stop", save: false }));
    await delay(250);
    ws.close();
    expect(events.items.some((event) => event.type === "error" && event.stage === "suggestion" && String(event.message).includes("DEEPSEEK_API_KEY"))).toBe(true);
    expect(events.items.some((event) => event.type === "suggestion")).toBe(false);
    const session = await getSession(user.token, String(ack.sessionId));
    expect(session.counts.suggestions).toBe(0);
  });

  it("fails audio sessions clearly without Deepgram key before DB session creation", async () => {
    const user = await devUser("it-audio@example.com");
    const ws = await openWs(user.token);
    const events = collectEvents(ws);
    ws.send(JSON.stringify({ ...startMessage({ situationDescription: "doctor visit", retentionPolicy: "ask_on_stop" }), source: "audio" }));
    await waitForEvent(events, "error");
    ws.close();
    expect(events.items.some((event) => event.type === "error" && event.stage === "asr" && String(event.message).includes("DEEPGRAM_API_KEY"))).toBe(true);
    expect(await tableCount("sessions", "status = 'active'")).toBe(0);
  });

  it("suppresses late provider writes after discard when provider rejects late", async () => {
    modules.setSessionJobOverridesForTest({
      suggest: async () => {
        await delay(300);
        throw new Error("late provider rejection");
      },
    });
    const user = await devUser("it-late@example.com");
    const sessionId = await runOneTranscript(user.token, "bank loan", "The APR is 9.4 percent.", "ask_on_stop", false);
    const session = await waitForSessionCounts(user.token, sessionId, { suggestions: 0, cueEvents: 0 });
    expect(session.status).toBe("discarded");
    expect(session.counts.suggestions).toBe(0);
    expect(session.counts.cueEvents).toBe(0);
  });

  it("deletes content on discard_on_stop disconnect and keeps content temporarily on ask_on_stop", async () => {
    const discardUser = await devUser("it-retention-discard@example.com");
    const discardSession = await disconnectAfterTranscript(discardUser.token, "discard_on_stop");
    const discarded = await getSession(discardUser.token, discardSession);
    expect(discarded.status).toBe("interrupted");
    expect(discarded.counts.transcriptSegments).toBe(0);
    expect(discarded.counts.cueEvents).toBe(0);

    const askUser = await devUser("it-retention-ask@example.com");
    const askSession = await disconnectAfterTranscript(askUser.token, "ask_on_stop");
    const asked = await getSession(askUser.token, askSession);
    expect(asked.status).toBe("interrupted");
    expect(asked.counts.transcriptSegments).toBeGreaterThan(0);
    expect(await tableCount("memories")).toBe(0);
  });
});

describe("integration voice control plane", () => {
  it("rejects /voice start without consent", async () => {
    const user = await devUser("it-voice-consent@example.com");
    const ws = await openVoiceWs(user.token);
    const events = collectEvents(ws);
    ws.send(JSON.stringify(voiceStartMessage({ consentGranted: false, situationDescription: "bank loan" })));
    await waitForEvent(events, "error");
    ws.close();
    await delay(100);
    expect(events.items.some((event) => event.type === "error" && event.stage === "consent")).toBe(true);
    expect(await tableCount("sessions", "status = 'active'")).toBe(0);
    expect(await tableCount("voice_sessions")).toBe(0);
    expect(await tableCount("transcript_segments")).toBe(0);
  });

  it("answers deterministic bank prep without Anthropic and persists turns/outputs", async () => {
    const user = await devUser("it-voice-prep-bank@example.com");
    const situation = await createSituation(user.token, "I am going to the bank to discuss a mortgage loan");
    const ws = await openVoiceWs(user.token);
    const events = collectEvents(ws);
    ws.send(JSON.stringify(voiceStartMessage({ policy: "conversation_agent", situationBriefId: situation.situationBrief.id, outputKind: "text" })));
    const ack = await waitForEvent(events, "voice_ack");
    ws.send(JSON.stringify({ type: "user_text", text: "What should I ask before this bank loan meeting?" }));
    const answer = await waitForEvent(events, "voice_assistant_text");
    expect(String(answer.text)).toContain("APR");
    const session = await getSession(user.token, String(ack.sessionId));
    expect(session.counts.agentTurns).toBeGreaterThanOrEqual(2);
    expect(session.counts.voiceOutputs).toBeGreaterThanOrEqual(1);
    ws.close();
  });

  it("emits whisper bank cue, speak request, and tts unavailable", async () => {
    const user = await devUser("it-voice-whisper-bank@example.com");
    const situation = await createSituation(user.token, "I am going to the bank to discuss a mortgage loan");
    const ws = await openVoiceWs(user.token);
    const events = collectEvents(ws);
    ws.send(JSON.stringify(voiceStartMessage({ policy: "whisper_copilot", situationBriefId: situation.situationBrief.id, outputKind: "both" })));
    await waitForEvent(events, "voice_ack");
    ws.send(JSON.stringify({ type: "transcript", speaker: "speaker_1", text: "The APR is 9.4 percent and there is also an arrangement fee.", offsetMs: 1200 }));
    const cue = await waitForEvent(events, "voice_cue");
    await waitForEvent(events, "voice_segment");
    await waitForEvent(events, "voice_triggers");
    await waitForEvent(events, "voice_speak_request");
    await waitForEvent(events, "voice_tts_unavailable");
    expect(String((cue.cue as { spokenCue: string }).spokenCue).split(/\s+/).length).toBeLessThanOrEqual(8);
    ws.close();
  });

  it("emits doctor-safe whisper cue", async () => {
    const user = await devUser("it-voice-whisper-doctor@example.com");
    const situation = await createSituation(user.token, "I have a doctor appointment about blood test results");
    const ws = await openVoiceWs(user.token);
    const events = collectEvents(ws);
    ws.send(JSON.stringify(voiceStartMessage({ policy: "whisper_copilot", situationBriefId: situation.situationBrief.id, outputKind: "both" })));
    await waitForEvent(events, "voice_ack");
    ws.send(JSON.stringify({ type: "transcript", speaker: "speaker_1", text: "We should discuss your blood test result and medication side effects.", offsetMs: 1200 }));
    const cue = await waitForEvent(events, "voice_cue");
    ws.close();
    expect(JSON.stringify(cue.cue).toLowerCase()).not.toMatch(/\byou should (take|stop|change)|i recommend treatment\b/);
  });

  it("rejects audio_pcm16 without Deepgram before activation", async () => {
    const user = await devUser("it-voice-audio@example.com");
    const ws = await openVoiceWs(user.token);
    const events = collectEvents(ws);
    ws.send(JSON.stringify(voiceStartMessage({ inputKind: "audio_pcm16", situationDescription: "doctor visit" })));
    await waitForEvent(events, "error");
    ws.send(Buffer.from([0, 1, 2, 3]));
    ws.close();
    expect(events.items.some((event) => event.type === "error" && event.stage === "provider" && String(event.message).includes("DEEPGRAM_API_KEY"))).toBe(true);
    expect(await tableCount("sessions", "status = 'active'")).toBe(0);
    expect(await tableCount("voice_sessions")).toBe(0);
  });

  it("cancels current speech on barge-in", async () => {
    const user = await devUser("it-voice-barge@example.com");
    const ws = await openVoiceWs(user.token);
    const events = collectEvents(ws);
    ws.send(JSON.stringify(voiceStartMessage({ policy: "conversation_agent", situationDescription: "bank loan", outputKind: "both" })));
    const ack = await waitForEvent(events, "voice_ack");
    ws.send(JSON.stringify({ type: "user_text", text: "What should I ask before this bank loan meeting?" }));
    const speak = await waitForEvent(events, "voice_speak_request");
    ws.send(JSON.stringify({ type: "speech_started" }));
    const cancel = await waitForEvent(events, "voice_cancel_speech");
    ws.close();
    expect(cancel.speechId).toBe(speak.speechId);
    const outputs = await getVoiceOutputs(user.token, String(ack.sessionId));
    expect(outputs.some((output) => output.speechId === speak.speechId && output.status === "canceled")).toBe(true);
  });

  it("discards voice turns, outputs, transcript, and cues on save=false", async () => {
    const user = await devUser("it-voice-discard@example.com");
    const ws = await openVoiceWs(user.token);
    const events = collectEvents(ws);
    ws.send(JSON.stringify(voiceStartMessage({ policy: "whisper_copilot", situationDescription: "bank loan", outputKind: "both" })));
    const ack = await waitForEvent(events, "voice_ack");
    ws.send(JSON.stringify({ type: "transcript", speaker: "speaker_1", text: "The APR is 9.4 percent.", offsetMs: 1000 }));
    await waitForEvent(events, "voice_cue");
    ws.send(JSON.stringify({ type: "stop", save: false }));
    await waitForStatus(String(ack.sessionId), "discarded");
    await waitForVoiceState(user.token, String(ack.sessionId), "discarded");
    const session = await waitForSessionCounts(user.token, String(ack.sessionId), {
      transcriptSegments: 0,
      suggestions: 0,
      cueEvents: 0,
      agentTurns: 0,
      voiceOutputs: 0,
    });
    const voiceSession = await getVoiceSession(user.token, String(ack.sessionId));
    ws.close();
    expect(voiceSession.state).toBe("discarded");
    expect(session.counts).toMatchObject({ transcriptSegments: 0, suggestions: 0, cueEvents: 0, agentTurns: 0, voiceOutputs: 0 });
  });

  it("marks voice disconnect interrupted without auto-save", async () => {
    const user = await devUser("it-voice-disconnect@example.com");
    const ws = await openVoiceWs(user.token);
    const events = collectEvents(ws);
    ws.send(JSON.stringify(voiceStartMessage({ policy: "conversation_agent", situationDescription: "bank loan", outputKind: "text" })));
    const ack = await waitForEvent(events, "voice_ack");
    ws.send(JSON.stringify({ type: "user_text", text: "What should I ask before this bank loan meeting?" }));
    await waitForEvent(events, "voice_assistant_text");
    ws.close();
    await waitForStatus(String(ack.sessionId), "interrupted");
    const session = await getSession(user.token, String(ack.sessionId));
    const voiceSession = await getVoiceSession(user.token, String(ack.sessionId));
    expect(session.status).toBe("interrupted");
    expect(voiceSession.state).toBe("interrupted");
    expect(events.items.some((event) => event.type === "summary")).toBe(false);
    expect(await tableCount("memories")).toBe(0);
  });

  it("enforces ownership on voice debug endpoints", async () => {
    const userA = await devUser("it-voice-owner-a@example.com");
    const userB = await devUser("it-voice-owner-b@example.com");
    const ws = await openVoiceWs(userA.token);
    const events = collectEvents(ws);
    ws.send(JSON.stringify(voiceStartMessage({ policy: "conversation_agent", situationDescription: "bank loan", outputKind: "text" })));
    const ack = await waitForEvent(events, "voice_ack");
    ws.send(JSON.stringify({ type: "user_text", text: "What should I ask before this bank loan meeting?" }));
    await waitForEvent(events, "voice_assistant_text");
    const urls = [`/sessions/${ack.sessionId}/turns`, `/sessions/${ack.sessionId}/voice-outputs`, `/sessions/${ack.sessionId}/voice-session`];
    for (const url of urls) {
      const response = await app.inject({ method: "GET", url, headers: auth(userB.token) });
      expect(response.statusCode).toBe(404);
    }
    ws.close();
  });

  it("suppresses late voice provider writes after discard", async () => {
    modules.setVoiceAgentForTest(async () => {
      await delay(300);
      return { kind: "provider_not_configured", message: "late provider rejection" };
    });
    const user = await devUser("it-voice-late@example.com");
    const ws = await openVoiceWs(user.token);
    const events = collectEvents(ws);
    ws.send(JSON.stringify(voiceStartMessage({ policy: "conversation_agent", situationDescription: "bank loan", outputKind: "text" })));
    const ack = await waitForEvent(events, "voice_ack");
    ws.send(JSON.stringify({ type: "user_text", text: "Write a strategy for me" }));
    ws.send(JSON.stringify({ type: "stop", save: false }));
    await waitForStatus(String(ack.sessionId), "discarded");
    await delay(500);
    const session = await getSession(user.token, String(ack.sessionId));
    ws.close();
    expect(session.counts.agentTurns).toBe(0);
    expect(session.counts.voiceOutputs).toBe(0);
  });
});

describe("integration adaptive brain", () => {
  it("requires auth for human profile and enforces profile fact ownership", async () => {
    const missing = await app.inject({ method: "GET", url: "/human/profile" });
    expect(missing.statusCode).toBe(401);
    const userA = await devUser("it-brain-profile-a@example.com");
    const userB = await devUser("it-brain-profile-b@example.com");
    await app.inject({ method: "POST", url: "/brain/query", headers: auth(userA.token), payload: { text: "I am a blockchain developer.", allowResearch: false } });
    const profile = await app.inject({ method: "GET", url: "/human/profile", headers: auth(userA.token) });
    const factId = (profile.json() as { summary: { confirmedFacts: Array<{ id: string }> } }).summary.confirmedFacts[0]?.id;
    expect(factId).toBeTruthy();
    const blocked = await app.inject({ method: "POST", url: `/human/profile/facts/${factId}/reject`, headers: auth(userB.token) });
    expect(blocked.statusCode).toBe(404);
    const review = await app.inject({ method: "GET", url: "/human/profile/review", headers: auth(userA.token) });
    expect(review.statusCode).toBe(200);
    expect(review.json()).toMatchObject({ pendingActions: expect.any(Object) });
  });

  it("supports stress opt-in/out and safe support responses", async () => {
    const user = await devUser("it-brain-stress@example.com");
    const optIn = await app.inject({ method: "POST", url: "/stress/opt-in", headers: auth(user.token) });
    expect(optIn.statusCode).toBe(200);
    const support = await app.inject({ method: "POST", url: "/stress/support", headers: auth(user.token), payload: { text: "I'm stressed before this meeting." } });
    expect(support.statusCode).toBe(200);
    expect(JSON.stringify(support.json())).not.toMatch(/diagnos|therapy|treatment plan/i);
    const optOut = await app.inject({ method: "POST", url: "/stress/opt-out", headers: auth(user.token) });
    expect(optOut.statusCode).toBe(200);
    const settings = await app.inject({ method: "GET", url: "/stress/settings", headers: auth(user.token) });
    expect(settings.statusCode).toBe(200);
    expect(JSON.stringify(settings.json())).toContain("3114");
  });

  it("answers brain query with confirmed profile context", async () => {
    const user = await devUser("it-brain-query@example.com");
    await app.inject({ method: "POST", url: "/brain/query", headers: auth(user.token), payload: { text: "I am a blockchain developer.", allowResearch: false } });
    const response = await app.inject({
      method: "POST",
      url: "/brain/query",
      headers: auth(user.token),
      payload: { text: "Prepare me for a bank loan meeting.", allowResearch: false, allowProfileContext: true },
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.stringify(response.json())).toContain("blockchain developer");
  });

  it("returns provider_not_configured for research provider none without fake citations", async () => {
    const user = await devUser("it-brain-research@example.com");
    const response = await app.inject({ method: "POST", url: "/research/query", headers: auth(user.token), payload: { text: "Check current mortgage rates in France." } });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(JSON.stringify(body)).toContain("provider_not_configured");
    expect(body.sources).toEqual([]);
    const providers = await app.inject({ method: "GET", url: "/research/providers", headers: auth(user.token) });
    expect(providers.statusCode).toBe(200);
    expect(providers.json()).toMatchObject({ selected: "none", configured: false });
  });

  it("lists tools and denies dangerous invocations", async () => {
    const user = await devUser("it-brain-tools@example.com");
    const tools = await app.inject({ method: "GET", url: "/tools", headers: auth(user.token) });
    expect(tools.statusCode).toBe(200);
    expect(JSON.stringify(tools.json())).toContain("web_search");
    const denied = await app.inject({ method: "POST", url: "/tools/execute_code/invoke", headers: auth(user.token), payload: { input: { command: "date" } } });
    expect(denied.statusCode).toBe(200);
    expect(JSON.stringify(denied.json())).toContain("denied");
    const permissions = await app.inject({ method: "GET", url: "/tools/permissions", headers: auth(user.token) });
    expect(permissions.statusCode).toBe(200);
    expect(JSON.stringify(permissions.json())).toContain("execute_code");
  });

  it("creates proposed skills without auto-enabling and enforces ownership", async () => {
    const userA = await devUser("it-brain-skill-a@example.com");
    const userB = await devUser("it-brain-skill-b@example.com");
    await app.inject({ method: "POST", url: "/brain/query", headers: auth(userA.token), payload: { text: "I keep preparing for bank loan meetings about mortgage APR.", allowResearch: false } });
    const skillsResponse = await app.inject({ method: "GET", url: "/skills", headers: auth(userA.token) });
    const rows = (skillsResponse.json() as { skills: Array<{ id: string; status: string }> }).skills;
    expect(rows.some((skill) => skill.status === "proposed")).toBe(true);
    expect(rows.some((skill) => skill.status === "enabled")).toBe(false);
    const blocked = await app.inject({ method: "POST", url: `/skills/${rows[0]?.id}/enable`, headers: auth(userB.token) });
    expect(blocked.statusCode).toBe(404);
    const premature = await app.inject({ method: "POST", url: `/skills/${rows[0]?.id}/enable`, headers: auth(userA.token) });
    expect(premature.statusCode).toBe(404);
    const approved = await app.inject({ method: "POST", url: `/skills/${rows[0]?.id}/approve`, headers: auth(userA.token) });
    expect(approved.statusCode).toBe(200);
    const enabled = await app.inject({ method: "POST", url: `/skills/${rows[0]?.id}/enable`, headers: auth(userA.token) });
    expect(enabled.statusCode).toBe(200);
    const matched = await app.inject({
      method: "POST",
      url: "/skills/match",
      headers: auth(userA.token),
      payload: { situationDescription: "I have a bank loan meeting tomorrow", internalType: "bank_loan" },
    });
    expect(matched.statusCode).toBe(200);
    expect((matched.json() as { skills: Array<{ status: string }> }).skills.every((skill) => skill.status === "enabled")).toBe(true);
  });

  it("saved sessions can propose profile facts, but discarded and interrupted sessions do not retain them", async () => {
    const user = await devUser("it-brain-session-facts@example.com");
    const savedSession = await runOneTranscript(user.token, "general", "I am a blockchain developer.", "ask_on_stop", true);
    expect(savedSession).toBeTruthy();
    await waitForTableCount("human_profile_facts", 1);
    expect(await tableCount("human_profile_facts")).toBeGreaterThan(0);
    const beforeDiscard = await tableCount("human_profile_facts");
    await runOneTranscript(user.token, "general", "I am a doctor and I panic in meetings.", "ask_on_stop", false);
    expect(await tableCount("human_profile_facts")).toBe(beforeDiscard);
    const interrupted = await runInterruptedVoiceUserText(user.token, "I am an interrupted-only consultant.");
    expect(interrupted).toBeTruthy();
    expect(await tableCount("human_profile_facts", "content = 'interrupted-only'")).toBe(0);
    const reflections = await app.inject({ method: "GET", url: "/brain/reflections", headers: auth(user.token) });
    expect(reflections.statusCode).toBe(200);
    expect(JSON.stringify(reflections.json())).toContain(savedSession);
  });

  it("returns dashboard and audit events control surfaces", async () => {
    const user = await devUser("it-brain-dashboard@example.com");
    await app.inject({ method: "POST", url: "/brain/query", headers: auth(user.token), payload: { text: "Prepare me for a bank loan meeting.", allowResearch: false } });
    const dashboard = await app.inject({ method: "GET", url: "/brain/dashboard", headers: auth(user.token) });
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.json()).toMatchObject({ safetySummary: expect.any(Object), researchProviderStatus: expect.any(Object) });
    const audit = await app.inject({ method: "GET", url: "/brain/audit-events", headers: auth(user.token) });
    expect(audit.statusCode).toBe(200);
    expect((audit.json() as { auditEvents: unknown[] }).auditEvents.length).toBeGreaterThan(0);
  });

  it("voice conversation adapts to confirmed profile and whisper cues stay short", async () => {
    const user = await devUser("it-brain-voice@example.com");
    await app.inject({ method: "POST", url: "/brain/query", headers: auth(user.token), payload: { text: "I am a blockchain developer.", allowResearch: false } });
    const ws = await openVoiceWs(user.token);
    const events = collectEvents(ws);
    ws.send(JSON.stringify(voiceStartMessage({ policy: "conversation_agent", situationDescription: "bank loan", outputKind: "text" })));
    await waitForEvent(events, "voice_ack");
    ws.send(JSON.stringify({ type: "user_text", text: "What should I ask before this bank loan meeting?" }));
    const answer = await waitForEvent(events, "voice_assistant_text");
    expect(String(answer.text)).toContain("blockchain developer");
    ws.close();

    const whisper = await openVoiceWs(user.token);
    const whisperEvents = collectEvents(whisper);
    whisper.send(JSON.stringify(voiceStartMessage({ policy: "whisper_copilot", situationDescription: "bank loan", outputKind: "both" })));
    await waitForEvent(whisperEvents, "voice_ack");
    whisper.send(JSON.stringify({ type: "transcript", speaker: "speaker_1", text: "The APR is 9.4 percent.", offsetMs: 1000 }));
    const cue = await waitForEvent(whisperEvents, "voice_cue");
    expect(String((cue.cue as { spokenCue: string }).spokenCue).split(/\s+/).length).toBeLessThanOrEqual(8);
    whisper.close();
  });

  it("self-harm text emits crisis boundary response instead of normal coaching", async () => {
    const user = await devUser("it-brain-crisis@example.com");
    const response = await app.inject({ method: "POST", url: "/stress/support", headers: auth(user.token), payload: { text: "I might kill myself." } });
    expect(response.statusCode).toBe(200);
    const text = JSON.stringify(response.json());
    expect(text).toContain("not an emergency service");
    expect(text).not.toMatch(/try to reframe|therapy session|diagnosis/i);
  });
});

describe("integration daily life brain", () => {
  it("requires auth and supports proposed task lifecycle", async () => {
    const missing = await app.inject({ method: "GET", url: "/daily/tasks" });
    expect(missing.statusCode).toBe(401);
    const user = await devUser("it-daily-tasks@example.com");
    const proposed = await app.inject({
      method: "POST",
      url: "/daily/commitments/propose",
      headers: auth(user.token),
      payload: { text: "I need to send the bank documents by Friday.", sourceType: "manual" },
    });
    expect(proposed.statusCode).toBe(200);
    const inbox = await app.inject({ method: "GET", url: "/daily/tasks", headers: auth(user.token) });
    expect(inbox.statusCode).toBe(200);
    const task = (inbox.json() as { tasks: Array<{ id: string; status: string }> }).tasks[0];
    expect(task?.status).toBe("proposed");
    expect((await app.inject({ method: "POST", url: `/daily/tasks/${task.id}/accept`, headers: auth(user.token) })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: `/daily/tasks/${task.id}/done`, headers: auth(user.token) })).statusCode).toBe(200);
  });

  it("generates daily brief and meeting prep pack", async () => {
    const user = await devUser("it-daily-brief@example.com");
    await app.inject({ method: "POST", url: "/daily/commitments/propose", headers: auth(user.token), payload: { text: "I will follow up with the client tomorrow.", sourceType: "manual" } });
    const brief = await app.inject({ method: "POST", url: "/daily/brief/generate", headers: auth(user.token), payload: {} });
    expect(brief.statusCode).toBe(200);
    expect(JSON.stringify(brief.json())).toContain("Today's priorities");
    const pack = await app.inject({ method: "POST", url: "/meetings/prep-pack", headers: auth(user.token), payload: { situationDescription: "I am going to the bank to discuss a loan." } });
    expect(pack.statusCode).toBe(200);
    expect(JSON.stringify(pack.json())).toMatch(/APR|repayment|fees/i);
  });

  it("saved sessions propose tasks and discarded sessions do not", async () => {
    const user = await devUser("it-daily-sessions@example.com");
    await runOneTranscript(user.token, "bank loan", "I will send the bank documents by Friday.", "ask_on_stop", true);
    await waitForTableCount("commitments", 1);
    const before = await tableCount("commitments");
    await runOneTranscript(user.token, "bank loan", "I will send a fake discarded task by Friday.", "ask_on_stop", false);
    expect(await tableCount("commitments")).toBe(before);
    const tasks = await app.inject({ method: "GET", url: "/daily/tasks", headers: auth(user.token) });
    expect(tasks.statusCode).toBe(200);
    expect(JSON.stringify(tasks.json())).toContain("bank documents");
    expect(JSON.stringify(tasks.json())).not.toContain("fake discarded");
  });

  it("voice can list open commitments", async () => {
    const user = await devUser("it-daily-voice@example.com");
    await app.inject({ method: "POST", url: "/daily/commitments/propose", headers: auth(user.token), payload: { text: "I need to send the bank documents by Friday.", sourceType: "manual" } });
    const ws = await openVoiceWs(user.token);
    const events = collectEvents(ws);
    ws.send(JSON.stringify(voiceStartMessage({ policy: "conversation_agent", situationDescription: "daily planning", outputKind: "text" })));
    await waitForEvent(events, "voice_ack");
    ws.send(JSON.stringify({ type: "user_text", text: "What did I promise?" }));
    const answer = await waitForEvent(events, "voice_assistant_text");
    ws.send(JSON.stringify({ type: "stop", save: false }));
    ws.close();
    expect(String(answer.text)).toContain("Open commitments");
  });
});

describe("integration action approval and connectors", () => {
  it("requires auth, creates proposals, and enforces ownership", async () => {
    const missing = await app.inject({ method: "GET", url: "/actions/proposals" });
    expect(missing.statusCode).toBe(401);
    const userA = await devUser("it-actions-a@example.com");
    const userB = await devUser("it-actions-b@example.com");
    const created = await app.inject({
      method: "POST",
      url: "/actions/proposals",
      headers: auth(userA.token),
      payload: {
        actionType: "draft_email",
        sourceType: "manual",
        title: "Draft follow-up email",
        description: "Draft only; do not send.",
        payload: { to: "client@example.com", body: "Thanks for meeting.", sendDisabled: true },
      },
    });
    expect(created.statusCode).toBe(200);
    const id = (created.json() as { proposal: { id: string; status: string } }).proposal.id;
    expect((created.json() as { proposal: { status: string } }).proposal.status).toBe("proposed");
    const blocked = await app.inject({ method: "GET", url: `/actions/proposals/${id}`, headers: auth(userB.token) });
    expect(blocked.statusCode).toBe(404);
  });

  it("approves/rejects proposals and executes safe internal actions only", async () => {
    const user = await devUser("it-actions-lifecycle@example.com");
    const created = await app.inject({
      method: "POST",
      url: "/actions/proposals",
      headers: auth(user.token),
      payload: {
        actionType: "propose_reminder",
        sourceType: "manual",
        title: "Send bank documents",
        description: "Internal reminder only.",
        payload: { title: "Send bank documents", detail: "Internal reminder only." },
      },
    });
    const id = (created.json() as { proposal: { id: string } }).proposal.id;
    const approved = await app.inject({ method: "POST", url: `/actions/proposals/${id}/approve`, headers: auth(user.token), payload: { reason: "reviewed" } });
    expect(approved.statusCode).toBe(200);
    const executed = await app.inject({ method: "POST", url: `/actions/proposals/${id}/execute`, headers: auth(user.token), payload: {} });
    expect(executed.statusCode).toBe(200);
    expect(JSON.stringify(executed.json())).toContain("completed");
    const tasks = await app.inject({ method: "GET", url: "/daily/tasks", headers: auth(user.token) });
    expect(JSON.stringify(tasks.json())).toContain("Send bank documents");
  });

  it("blocks external connector execution without fake action", async () => {
    const user = await devUser("it-actions-external@example.com");
    const created = await app.inject({
      method: "POST",
      url: "/actions/proposals",
      headers: auth(user.token),
      payload: {
        actionType: "draft_email",
        sourceType: "manual",
        title: "Draft email",
        description: "Draft only.",
        payload: { to: "client@example.com", body: "Hello", sendDisabled: true },
      },
    });
    const id = (created.json() as { proposal: { id: string } }).proposal.id;
    await app.inject({ method: "POST", url: `/actions/proposals/${id}/approve`, headers: auth(user.token), payload: {} });
    const executed = await app.inject({ method: "POST", url: `/actions/proposals/${id}/execute`, headers: auth(user.token), payload: {} });
    expect(executed.statusCode).toBe(200);
    expect(JSON.stringify(executed.json())).toContain("connector_not_configured");
  });

  it("exposes disabled connector registry and permissions", async () => {
    const user = await devUser("it-connectors@example.com");
    const list = await app.inject({ method: "GET", url: "/connectors", headers: auth(user.token) });
    expect(list.statusCode).toBe(200);
    expect(JSON.stringify(list.json())).toContain("google_gmail");
    const permissions = await app.inject({ method: "GET", url: "/connectors/mcp_remote/permissions", headers: auth(user.token) });
    expect(permissions.statusCode).toBe(200);
    expect(JSON.stringify(permissions.json())).toContain("arbitrary_mcp_tool_invocation");
  });

  it("voice creates draft follow-up proposal without sending", async () => {
    const user = await devUser("it-actions-voice@example.com");
    const ws = await openVoiceWs(user.token);
    const events = collectEvents(ws);
    ws.send(JSON.stringify(voiceStartMessage({ policy: "conversation_agent", situationDescription: "client pricing meeting", outputKind: "text" })));
    await waitForEvent(events, "voice_ack");
    ws.send(JSON.stringify({ type: "user_text", text: "Draft follow-up email to the client about pricing." }));
    const answer = await waitForEvent(events, "voice_assistant_text");
    ws.send(JSON.stringify({ type: "stop", save: false }));
    ws.close();
    expect(String(answer.text)).toContain("draft-only action proposal");
    const proposals = await app.inject({ method: "GET", url: "/actions/proposals", headers: auth(user.token) });
    expect(JSON.stringify(proposals.json())).toContain("draft_email");
  });
});

describe("integration subagent orchestration", () => {
  it("creates research task with provider_not_configured report and enforces ownership", async () => {
    const userA = await devUser("it-subagent-a@example.com");
    const userB = await devUser("it-subagent-b@example.com");
    const created = await app.inject({
      method: "POST",
      url: "/subagents/tasks",
      headers: auth(userA.token),
      payload: researchSubagentPayload("official APR explanation consumer loan"),
    });
    expect(created.statusCode).toBe(200);
    const taskId = (created.json() as { task: { id: string } }).task.id;
    const report = await waitForSubagentReport(userA.token, taskId);
    expect(JSON.stringify(report)).toContain("provider_not_configured");
    expect(JSON.stringify(report)).not.toMatch(/"citations":\s*\[[^\]]+\]/);
    const blocked = await app.inject({ method: "GET", url: `/subagents/tasks/${taskId}`, headers: auth(userB.token) });
    expect(blocked.statusCode).toBe(404);
    const events = await app.inject({ method: "GET", url: `/subagents/events/${taskId}`, headers: auth(userA.token) });
    expect(events.statusCode).toBe(200);
    expect((events.json() as { events: unknown[] }).events.length).toBeGreaterThan(0);
  });

  it("can cancel a queued/running task", async () => {
    const user = await devUser("it-subagent-cancel@example.com");
    const created = await app.inject({
      method: "POST",
      url: "/subagents/tasks",
      headers: auth(user.token),
      payload: researchSubagentPayload("latest official APR explanation consumer loan"),
    });
    const taskId = (created.json() as { task: { id: string } }).task.id;
    const canceled = await app.inject({ method: "POST", url: `/subagents/tasks/${taskId}/cancel`, headers: auth(user.token) });
    expect(canceled.statusCode).toBe(200);
    await delay(100);
    const task = await app.inject({ method: "GET", url: `/subagents/tasks/${taskId}`, headers: auth(user.token) });
    expect(["canceled", "suppressed", "failed", "completed"]).toContain((task.json() as { task: { status: string } }).task.status);
  });

  it("brain query subagent mode returns task id and dashboard counts include subagents", async () => {
    const user = await devUser("it-subagent-brain@example.com");
    const response = await app.inject({
      method: "POST",
      url: "/brain/query",
      headers: auth(user.token),
      payload: { text: "Check current mortgage fee rules and prepare me.", allowResearch: true, researchMode: "subagent" },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { status?: string; taskId?: string };
    expect(body.status).toBe("subagent_started");
    expect(body.taskId).toBeTruthy();
    await waitForSubagentReport(user.token, body.taskId!);
    const dashboard = await app.inject({ method: "GET", url: "/brain/dashboard", headers: auth(user.token) });
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.json()).toMatchObject({
      pendingSubagentTasksCount: expect.any(Number),
      runningSubagentTasksCount: expect.any(Number),
      recentSubagentReportsCount: expect.any(Number),
    });
  });

  it("voice emits subagent start and report while main agent keeps responding", async () => {
    const user = await devUser("it-subagent-voice@example.com");
    const ws = await openVoiceWs(user.token);
    const events = collectEvents(ws);
    ws.send(JSON.stringify(voiceStartMessage({ policy: "conversation_agent", situationDescription: "bank loan", outputKind: "text" })));
    await waitForEvent(events, "voice_ack");
    ws.send(JSON.stringify({ type: "user_text", text: "Can you check quickly what I should know about current loan fees?" }));
    await waitForEvent(events, "voice_assistant_text");
    await waitForEvent(events, "voice_subagent_started");
    await waitForEvent(events, "voice_subagent_report", 9000);
    ws.send(JSON.stringify({ type: "stop", save: false }));
    ws.close();
    expect(events.items.some((event) => event.type === "voice_subagent_report")).toBe(true);
  });

  it("whisper cues are not blocked and subagent reports are screen-only", async () => {
    const user = await devUser("it-subagent-whisper@example.com");
    const ws = await openVoiceWs(user.token);
    const events = collectEvents(ws);
    ws.send(JSON.stringify(voiceStartMessage({ policy: "whisper_copilot", situationDescription: "bank loan", outputKind: "both" })));
    await waitForEvent(events, "voice_ack");
    ws.send(JSON.stringify({ type: "transcript", speaker: "speaker_1", text: "The APR is 9.4 percent, there is an arrangement fee, and current fee rules may apply.", offsetMs: 1000 }));
    await waitForEvent(events, "voice_cue");
    await waitForEvent(events, "voice_subagent_report", 9000);
    const report = events.items.find((event) => event.type === "voice_subagent_report") as { delivery?: string } | undefined;
    expect(report?.delivery).toBe("screen_only");
    ws.send(JSON.stringify({ type: "stop", save: false }));
    ws.close();
  });
});

async function loadModules() {
  const [{ buildServer }, { db, pool, closeDb }, { runMigration }, redis, manager, voice] = await Promise.all([
    import("../src/server.js"),
    import("../src/db/client.js"),
    import("../src/scripts/migrate.js"),
    import("../src/redis.js"),
    import("../src/session/manager.js"),
    import("../src/voice/ws.js"),
  ]);
  return {
    buildServer,
    db,
    pool,
    closeDb,
    runMigration,
    closeRedis: redis.closeRedis,
    clearAllRedisForTest: redis.clearAllRedisForTest,
    setVoiceAgentForTest: voice.setVoiceAgentForTest,
    resetVoiceAgentForTest: voice.resetVoiceAgentForTest,
    ...manager,
  };
}

async function assertInfra(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    throw new Error(`Integration tests require Postgres and Redis. Run npm run setup:local. Postgres failed: ${(err as Error).message}`);
  } finally {
    await pool.end().catch(() => undefined);
  }
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { checkRedis } = await import("../src/redis.js");
    if (!(await checkRedis())) {
      throw new Error("Integration tests require Redis or Upstash REST. Run npm run setup:local.");
    }
  } else if (process.env.REDIS_URL) {
    const client = createClient({ url: process.env.REDIS_URL });
    try {
      await client.connect();
      await client.ping();
    } catch (err) {
      throw new Error(`Integration tests require Postgres and Redis. Run npm run setup:local. Redis failed: ${(err as Error).message}`);
    } finally {
      await client.quit().catch(() => undefined);
    }
  } else {
    const { checkRedis } = await import("../src/redis.js");
    if (!(await checkRedis())) {
      throw new Error("Integration tests require Redis or Upstash REST. Run npm run setup:local.");
    }
  }
}

async function cleanData(): Promise<void> {
  await modules.pool.query("TRUNCATE action_execution_logs, action_approvals, action_proposals, meeting_packs, followup_suggestions, daily_briefs, task_items, commitments, brain_audit_events, subagent_notifications, subagent_task_attempts, subagent_events, subagent_reports, subagent_tasks, skill_versions, skills, tool_invocations, tool_manifests, research_answers, research_sources, research_queries, stress_events, brain_reflections, user_feedback_events, context_relationships, context_entities, human_profile_facts, human_profiles, consent_events, transcript_segments, suggestions, cue_events, agent_turns, voice_outputs, voice_sessions, memories, sessions, situation_briefs, users RESTART IDENTITY CASCADE");
  await modules.clearAllRedisForTest();
}

async function devUser(email: string) {
  const response = await app.inject({ method: "POST", url: "/dev/users", payload: { email, displayName: "Integration Test" } });
  expect(response.statusCode).toBe(200);
  return response.json() as { user: { id: string; email: string }; token: string };
}

async function createSituation(token: string, description: string) {
  const response = await app.inject({ method: "POST", url: "/situations", headers: auth(token), payload: { description } });
  expect(response.statusCode).toBe(200);
  return response.json() as { situationBrief: { id: string; inferredType: string } };
}

function auth(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

async function openWs(token: string): Promise<WebSocket> {
  const ws = new WebSocket(`${wsUrl}/session?token=${encodeURIComponent(token)}`);
  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  return ws;
}

async function openVoiceWs(token: string): Promise<WebSocket> {
  const ws = new WebSocket(`${wsUrl}/voice?token=${encodeURIComponent(token)}`);
  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  return ws;
}

function collectEvents(ws: WebSocket): { items: Array<{ type: string; [key: string]: unknown }> } {
  const collection = { items: [] as Array<{ type: string; [key: string]: unknown }> };
  ws.on("message", (data) => {
    collection.items.push(JSON.parse(data.toString()) as { type: string; [key: string]: unknown });
  });
  return collection;
}

async function waitForEvent(collection: { items: Array<{ type: string; [key: string]: unknown }> }, type: string, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const event = collection.items.find((item) => item.type === type);
    if (event) return event;
    await delay(25);
  }
  throw new Error(`Timed out waiting for ${type}; saw ${JSON.stringify(collection.items)}`);
}

function startMessage(args: {
  situationBriefId?: string;
  situationDescription?: string;
  retentionPolicy?: "save_on_stop" | "discard_on_stop" | "ask_on_stop";
  consentGranted?: boolean;
}) {
  return {
    type: "start",
    situationBriefId: args.situationBriefId,
    situationDescription: args.situationDescription,
    consent: {
      granted: args.consentGranted ?? true,
      method: "user_tap",
      noticeText: "Live Assist is active. I confirm I have the right consent for this conversation.",
      participantCount: 2,
      jurisdiction: "unknown",
    },
    title: "Integration session",
    source: "text",
    retentionPolicy: args.retentionPolicy ?? "ask_on_stop",
    selfSpeakerIndex: 0,
  };
}

function voiceStartMessage(args: {
  policy?: "conversation_agent" | "whisper_copilot";
  situationBriefId?: string;
  situationDescription?: string;
  inputKind?: "text" | "audio_pcm16";
  outputKind?: "text" | "tts" | "both";
  retentionPolicy?: "save_on_stop" | "discard_on_stop" | "ask_on_stop";
  consentGranted?: boolean;
}) {
  return {
    type: "start",
    policy: args.policy ?? "conversation_agent",
    situationBriefId: args.situationBriefId,
    situationDescription: args.situationDescription,
    title: "Voice integration session",
    consent: {
      granted: args.consentGranted ?? true,
      method: "user_tap",
      noticeText: "Live Assist is active. I confirm I have the right consent for this conversation.",
      participantCount: args.policy === "whisper_copilot" ? 2 : 1,
      jurisdiction: "unknown",
    },
    input: { kind: args.inputKind ?? "text" },
    output: { kind: args.outputKind ?? "text" },
    retentionPolicy: args.retentionPolicy ?? "ask_on_stop",
  };
}

async function runOneTranscript(
  token: string,
  description: string,
  text: string,
  retentionPolicy: "save_on_stop" | "discard_on_stop" | "ask_on_stop",
  save: boolean,
  situationBriefId?: string,
): Promise<string> {
  const ws = await openWs(token);
  const events = collectEvents(ws);
  ws.send(JSON.stringify(startMessage({ situationBriefId, situationDescription: situationBriefId ? undefined : description, retentionPolicy })));
  const ack = await waitForEvent(events, "ack");
  ws.send(JSON.stringify({ type: "transcript", speaker: "speaker_1", text, offsetMs: 1000 }));
  await waitForEvent(events, "segment");
  ws.send(JSON.stringify({ type: "stop", save }));
  await waitForStatus(String(ack.sessionId), save ? "saved" : "discarded");
  ws.close();
  return String(ack.sessionId);
}

async function disconnectAfterTranscript(token: string, retentionPolicy: "save_on_stop" | "discard_on_stop" | "ask_on_stop"): Promise<string> {
  const ws = await openWs(token);
  const events = collectEvents(ws);
  ws.send(JSON.stringify(startMessage({ situationDescription: "bank loan", retentionPolicy })));
  const ack = await waitForEvent(events, "ack");
  ws.send(JSON.stringify({ type: "transcript", speaker: "speaker_1", text: "The APR is 9.4 percent.", offsetMs: 1000 }));
  await waitForEvent(events, "segment");
  ws.close();
  await waitForStatus(String(ack.sessionId), "interrupted");
  return String(ack.sessionId);
}

async function runInterruptedVoiceUserText(token: string, text: string): Promise<string> {
  const ws = await openVoiceWs(token);
  const events = collectEvents(ws);
  ws.send(JSON.stringify(voiceStartMessage({ policy: "conversation_agent", situationDescription: "profile test", outputKind: "text" })));
  const ack = await waitForEvent(events, "voice_ack");
  ws.send(JSON.stringify({ type: "user_text", text }));
  ws.close();
  await waitForStatus(String(ack.sessionId), "interrupted");
  return String(ack.sessionId);
}

async function waitForStatus(sessionId: string, status: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await modules.pool.query("SELECT status FROM sessions WHERE id = $1", [sessionId]);
    if (result.rows[0]?.status === status) return;
    await delay(25);
  }
  throw new Error(`Timed out waiting for session ${sessionId} to become ${status}`);
}

async function waitForVoiceState(token: string, sessionId: string, state: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const voiceSession = await getVoiceSession(token, sessionId);
    if (voiceSession.state === state) return;
    await delay(50);
  }
  throw new Error(`Timed out waiting for voice session ${sessionId} to become ${state}`);
}

async function waitForSessionCounts(
  token: string,
  sessionId: string,
  expected: Partial<{ transcriptSegments: number; suggestions: number; cueEvents: number; agentTurns: number; voiceOutputs: number }>,
  timeoutMs = 5000,
) {
  const deadline = Date.now() + timeoutMs;
  let last = await getSession(token, sessionId);
  while (Date.now() < deadline) {
    last = await getSession(token, sessionId);
    if (Object.entries(expected).every(([key, value]) => last.counts[key as keyof typeof last.counts] === value)) return last;
    await delay(50);
  }
  return last;
}

async function waitForTableCount(table: string, minimum: number, where = "true", timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await tableCount(table, where)) >= minimum) return;
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${table} count >= ${minimum}`);
}

async function getSession(token: string, sessionId: string) {
  const response = await app.inject({ method: "GET", url: `/sessions/${sessionId}`, headers: auth(token) });
  expect(response.statusCode).toBe(200);
  return response.json() as {
    status: string;
    counts: { transcriptSegments: number; suggestions: number; cueEvents: number; agentTurns: number; voiceOutputs: number };
  };
}

async function getVoiceSession(token: string, sessionId: string) {
  const response = await app.inject({ method: "GET", url: `/sessions/${sessionId}/voice-session`, headers: auth(token) });
  expect(response.statusCode).toBe(200);
  return (response.json() as { voiceSession: { state: string } }).voiceSession;
}

async function getVoiceOutputs(token: string, sessionId: string) {
  const response = await app.inject({ method: "GET", url: `/sessions/${sessionId}/voice-outputs`, headers: auth(token) });
  expect(response.statusCode).toBe(200);
  return (response.json() as { voiceOutputs: Array<{ speechId: string | null; status: string }> }).voiceOutputs;
}

function researchSubagentPayload(query: string) {
  return {
    kind: "research",
    trigger: "user_request",
    priority: "normal",
    input: { query, intent: "bank_loan", internalType: "bank_loan" },
    policy: {
      allowResearch: true,
      allowProfileContext: false,
      allowMemory: false,
      allowStressSupport: false,
      allowUserFacingReport: true,
      liveDelivery: "screen_only",
    },
  };
}

async function waitForSubagentReport(token: string, taskId: string, timeoutMs = 8000): Promise<unknown> {
  const deadline = Date.now() + timeoutMs;
  let lastTask: unknown = null;
  while (Date.now() < deadline) {
    const task = await app.inject({ method: "GET", url: `/subagents/tasks/${taskId}`, headers: auth(token) });
    expect(task.statusCode).toBe(200);
    lastTask = task.json();
    const status = (lastTask as { task: { status: string } }).task.status;
    if (["completed", "failed", "suppressed"].includes(status)) {
      const report = await app.inject({ method: "GET", url: `/subagents/tasks/${taskId}/report`, headers: auth(token) });
      expect(report.statusCode).toBe(200);
      return report.json();
    }
    await delay(50);
  }
  throw new Error(`Timed out waiting for subagent report; last=${JSON.stringify(lastTask)}`);
}

async function tableCount(table: string, where = "true"): Promise<number> {
  const result = await modules.pool.query(`SELECT count(*)::int AS count FROM ${table} WHERE ${where}`);
  return Number(result.rows[0]?.count ?? 0);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
