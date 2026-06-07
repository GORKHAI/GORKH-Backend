import { runStorageReplay, storageReplayScenarios } from "./storage-replay.js";

async function main() {
  for (const scenario of storageReplayScenarios) {
    await runStorageReplay(scenario);
  }
  console.log("storage:replay:all passed");
}

main().catch((err) => {
  console.error(`storage:replay:all failed: ${(err as Error).message}`);
  process.exit(1);
});

