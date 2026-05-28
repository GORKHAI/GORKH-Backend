import { run } from "./mobile-replay.js";

const scenarios = [
  "protocol-version",
  "error-codes",
  "reconnect-state",
  "profile-mutation-gate",
  "research-citation-details",
  "governor-budget",
  "notification-sync",
  "duplicate-task-suppression",
  "latency-summary",
] as const;

for (const scenario of scenarios) {
  await run(scenario);
}

console.log(`mobile:replay:all passed ${scenarios.length} scenario(s)`);
