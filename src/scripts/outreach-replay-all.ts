import { spawn } from "node:child_process";

const scenarios = [
  "campaign-create",
  "investor-research-no-provider",
  "investor-research-live-if-configured",
  "investor-scoring",
  "draft-email",
  "compliance-check",
  "action-proposal",
  "voice-investor-research",
  "lead-dedupe",
  "contact-confidence",
  "draft-quality-review",
  "campaign-quality-summary",
  "review-pack",
  "voice-campaign-review",
];

for (const scenario of scenarios) {
  await run("npm", ["run", "outreach:replay", "--", scenario]);
}

console.log(`outreach:replay:all passed ${scenarios.length} scenario(s)`);

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited ${code}`))));
  });
}
