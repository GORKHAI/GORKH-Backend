import { currentWorkerId } from "../subagents/queue.js";
import { subagentQueueMetrics } from "../subagents/metrics.js";

console.log(JSON.stringify(await subagentQueueMetrics(currentWorkerId()), null, 2));
