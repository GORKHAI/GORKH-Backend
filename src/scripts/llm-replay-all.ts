import { spawn } from "node:child_process";

const names = ["open-ended-bank", "suggestion-bank"];

for (const name of names) {
  await run(name);
}

function run(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "llm:replay", "--", name], { stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`llm replay ${name} exited ${code}`))));
    child.on("error", reject);
  });
}
