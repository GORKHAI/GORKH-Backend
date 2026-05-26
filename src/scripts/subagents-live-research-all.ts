import { spawn } from "node:child_process";

for (const name of ["bank-apr", "doctor-test-results", "company-brief"]) {
  await run("npm", ["run", "subagents:live-research", "--", name]);
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, SUBAGENT_LIVE_RESEARCH_SCENARIO: args.at(-1) ?? "bank-apr" };
    const child = spawn(command, args, { stdio: "inherit", env });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited ${code}`))));
  });
}
