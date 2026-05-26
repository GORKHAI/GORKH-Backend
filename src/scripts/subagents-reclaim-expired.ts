import { reclaimExpiredSubagentLeases } from "../subagents/leases.js";

async function main(): Promise<void> {
  const reclaimed = await reclaimExpiredSubagentLeases();
  console.log(`subagents:queue:reclaim-expired reclaimed=${reclaimed}`);
}

main().catch((err) => {
  console.error(`subagents:queue:reclaim-expired failed: ${(err as Error).message}`);
  process.exit(1);
});
