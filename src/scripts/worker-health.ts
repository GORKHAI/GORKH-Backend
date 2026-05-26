import { checkDb } from "../db/client.js";
import { checkRedis } from "../redis.js";
import { currentWorkerId } from "../subagents/queue.js";
import { subagentQueueMetrics } from "../subagents/metrics.js";

const metrics = await subagentQueueMetrics(currentWorkerId());
const healthy = (await checkDb()) && (await checkRedis());
console.log(JSON.stringify({ ok: healthy, workerId: metrics.workerId, runnerMode: metrics.runnerMode, dbReachable: metrics.dbReachable, redisReachable: metrics.redisReachable }, null, 2));
if (!healthy) process.exit(1);
