import { queueStatus } from "../subagents/queue.js";

async function main(): Promise<void> {
  console.log(JSON.stringify(await queueStatus(), null, 2));
}

main().catch((err) => {
  console.error(`subagents:queue:inspect failed: ${(err as Error).message}`);
  process.exit(1);
});
