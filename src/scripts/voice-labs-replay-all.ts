import { spawn } from "node:child_process";

const scenarios = ["vibevoice-config", "vibevoice-disabled", "tts-safety", "production-path-unchanged"];

for (const scenario of scenarios) {
  await run("npm", ["run", "voice-labs:replay", "--", scenario]);
}

console.log(`voice-labs:replay:all passed ${scenarios.length} scenario(s)`);

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited ${code}`))));
  });
}
