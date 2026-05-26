import { spawn } from "node:child_process";
import { printSummary, runCheck } from "./live-verify-utils.js";

const scripts = [
  "live:verify:api",
  "live:verify:gateway",
  "live:verify:worker",
  "live:verify:brain",
  "live:verify:actions",
  "live:verify:research",
  "live:verify:privacy",
];

const checks = [];
for (const script of scripts) {
  checks.push(
    await runCheck(script, async () => {
      const result = await runNpm(script);
      return { exitCode: result.code };
    }),
  );
}

printSummary("live:verify", checks);

function runNpm(script: string): Promise<{ code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", script], { stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve({ code: code ?? 0 }) : reject(new Error(`${script} exited ${code}`))));
  });
}
