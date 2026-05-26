import { spawn } from "node:child_process";

const names = [
  "research-no-provider",
  "brain-query-subagent",
  "voice-research-sidechannel",
  "whisper-research-screen-only",
  "skill-match",
  "stress-support",
  "cancel-task",
  "durable-research-no-provider",
  "durable-brain-query",
  "worker-once",
  "retry-transient",
  "reclaim-expired",
  "sse-notifications",
  "cancel-durable-task",
  "discard-suppression",
  "whisper-screen-only-report",
  "research-live-if-configured",
];

async function main(): Promise<void> {
  for (const name of names) {
    console.log(`\n== subagents:replay ${name} ==`);
    await run(name);
  }
}

function run(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "subagents:replay", "--", name], { stdio: "inherit", env: process.env });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`subagents replay ${name} failed with code ${code}`));
    });
    child.on("error", reject);
  });
}

main().catch((err) => {
  console.error(`subagents:replay:all failed: ${(err as Error).message}`);
  process.exit(1);
});
