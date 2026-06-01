import { spawn } from "node:child_process";

const scenarios = [
  "not-configured",
  "create-room",
  "guest-link",
  "consent-required",
  "transcript-ingest",
  "summary",
  "outreach-room",
  "guest-permissions",
];

for (const scenario of scenarios) {
  await run("npm", ["run", "rooms:replay", "--", scenario]);
}

console.log(`rooms:replay:all passed ${scenarios.length} scenario(s)`);

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited ${code}`))));
  });
}
