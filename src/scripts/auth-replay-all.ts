import { authReplayScenarios, runAuthReplay } from "./auth-replay.js";
import { closeDb } from "../db/client.js";

async function main() {
  for (const scenario of authReplayScenarios) {
    await runAuthReplay(scenario);
  }
  console.log("auth:replay:all passed");
}

main()
  .catch((err) => {
    console.error(`auth:replay:all failed: ${(err as Error).message}`);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb().catch(() => undefined);
  });
