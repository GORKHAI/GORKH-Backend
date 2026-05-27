import { spawn } from "node:child_process";

const scenarios = [
  "extract-commitments",
  "task-inbox",
  "daily-brief",
  "meeting-prep-pack",
  "meeting-recap-pack",
  "voice-open-commitments",
  "discard-no-extraction",
  "quality-brief",
  "task-ranking",
  "commitment-review",
  "followup-review",
  "weekly-review",
  "feedback-loop",
  "voice-top-priorities",
];

for (const scenario of scenarios) {
  console.log(`daily:replay:${scenario}`);
  await run(scenario);
}

function run(scenario: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "daily:replay", "--", scenario], { stdio: "inherit", env: process.env });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${scenario} failed with ${code}`))));
    child.on("error", reject);
  });
}
