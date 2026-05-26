import { spawn } from "node:child_process";

const names = ["bank-apr", "doctor-test-results", "company-brief"];
for (const name of names) {
  await run("npm", ["run", "research:live", "--", name]);
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited ${code}`))));
  });
}
