import { config } from "../config.js";
import { processDueSubagentTasksOnce } from "../subagents/worker.js";
import { currentWorkerId } from "../subagents/queue.js";

async function main(): Promise<void> {
  const workerId = currentWorkerId();
  console.log(`subagents:worker started workerId=${workerId} mode=${config.SUBAGENT_RUNNER_MODE}`);
  for (;;) {
    await processDueSubagentTasksOnce({ workerId });
    await delay(config.SUBAGENT_WORKER_POLL_MS);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error(`subagents:worker failed: ${(err as Error).message}`);
  process.exit(1);
});
