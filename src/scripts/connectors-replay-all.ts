import { spawn } from "node:child_process";

const scenarios = ["scope-registry", "oauth-readiness", "calendar-fixture-import", "gmail-fixture-import", "daily-brief-from-fixtures", "action-preview-blocked", "mcp-security"];

for (const scenario of scenarios) {
  console.log(`connectors:replay:${scenario}`);
  await run("npm", ["run", "connectors:replay", "--", scenario]);
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited ${code}`))));
    child.on("error", reject);
  });
}
