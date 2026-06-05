import { relayReplayScenarios, runRelayReplay } from "./relay-replay.js";

async function main() {
  for (const scenario of relayReplayScenarios) {
    await runRelayReplay(scenario);
  }
  console.log("relay:replay:all passed");
}

main().catch((err) => {
  console.error(`relay:replay:all failed: ${(err as Error).message}`);
  process.exit(1);
});
