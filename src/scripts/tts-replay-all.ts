import { spawnSync } from "node:child_process";

const scenarios = ["provider-none", "disabled", "characters", "safety", "auth-required"];

for (const scenario of scenarios) {
  const result = spawnSync("npm", ["run", "tts:replay", "--", scenario], { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("tts:replay:all ok");
