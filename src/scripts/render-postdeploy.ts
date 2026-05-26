import { liveConfig, printSummary, requireUrl, runCheck } from "./live-verify-utils.js";
import { spawn } from "node:child_process";

const cfg = liveConfig();
requireUrl(cfg.apiUrl, "LIVE_API_URL");
requireUrl(cfg.gatewayUrl, "LIVE_GATEWAY_URL");

const checks = [
  await runCheck("live verification suite", async () => {
    await run("npm", ["run", "live:verify"]);
    return { nextManualChecks: ["/dev/live microphone validation", "/dev/brain control surface review"] };
  }),
];

printSummary("render:postdeploy", checks);

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited ${code}`))));
  });
}
