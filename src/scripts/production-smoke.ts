import { buildServer } from "../server.js";
import { runMigration } from "./migrate.js";
import { processDueSubagentTasksOnce } from "../subagents/worker.js";
import { checkDb } from "../db/client.js";
import { checkRedis } from "../redis.js";

const app = await buildServer();
try {
  await runMigration();
  const health = await app.inject({ method: "GET", url: "/health" });
  const dev = await app.inject({ method: "POST", url: "/dev/users", payload: { email: "production-smoke@example.com", displayName: "Production Smoke" } });
  if (dev.statusCode !== 200) throw new Error(`/dev/users unavailable in this environment; run smoke in non-production or use a real token`);
  const token = dev.json<{ token: string }>().token;
  const task = await app.inject({
    method: "POST",
    url: "/subagents/tasks",
    headers: { Authorization: `Bearer ${token}` },
    payload: {
      kind: "research",
      trigger: "user_request",
      priority: "normal",
      input: { query: "official APR explanation consumer loan", intent: "bank_loan" },
      policy: { allowResearch: true, allowProfileContext: false, allowMemory: false, allowStressSupport: false, allowUserFacingReport: true, liveDelivery: "screen_only" },
    },
  });
  if (task.statusCode !== 200) throw new Error(`task enqueue failed: ${task.statusCode} ${task.body}`);
  await processDueSubagentTasksOnce();
  const taskId = task.json<{ task: { id: string } }>().task.id;
  let report = await app.inject({ method: "GET", url: `/subagents/tasks/${taskId}/report`, headers: { Authorization: `Bearer ${token}` } });
  const deadline = Date.now() + 15_000;
  while (report.statusCode === 404 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await processDueSubagentTasksOnce();
    report = await app.inject({ method: "GET", url: `/subagents/tasks/${taskId}/report`, headers: { Authorization: `Bearer ${token}` } });
  }
  console.log(JSON.stringify({ ok: health.statusCode === 200 && report.statusCode === 200, db: await checkDb(), redis: await checkRedis(), health: health.json(), taskId, reportStatus: report.statusCode }, null, 2));
  if (health.statusCode !== 200 || report.statusCode !== 200) process.exit(1);
} finally {
  await app.close();
}
