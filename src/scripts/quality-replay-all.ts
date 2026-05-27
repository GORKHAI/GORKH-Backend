import { spawnSync } from "node:child_process";

const replays = [
  "tavily-bank-apr",
  "citation-validation",
  "no-fake-citation",
  "cue-latency",
  "governor-deterministic",
  "governor-budget",
  "provider-usage",
];

for (const replay of replays) {
  console.log(`quality:replay:${replay}`);
  const result = spawnSync("npm", ["run", "quality:replay", "--", replay], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
