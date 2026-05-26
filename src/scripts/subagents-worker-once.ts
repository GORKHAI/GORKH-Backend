import { processDueSubagentTasksOnce } from "../subagents/worker.js";
import { currentWorkerId } from "../subagents/queue.js";

async function main(): Promise<void> {
  const processed = await processDueSubagentTasksOnce({ workerId: currentWorkerId() });
  console.log(`subagents:worker:once processed=${processed}`);
}

main().catch((err) => {
  console.error(`subagents:worker:once failed: ${(err as Error).message}`);
  process.exit(1);
});
