import { spawn } from "node:child_process";

const scenarios = ["draft-email-proposal", "calendar-proposal", "reminder-internal", "connector-registry", "mcp-disabled", "approval-lifecycle", "voice-draft-followup"];

for (const scenario of scenarios) {
  console.log(`actions:replay:${scenario}`);
  await run("npm", ["run", "actions:replay", "--", scenario]);
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}
