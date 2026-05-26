import "dotenv/config";
import { readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { scanFilesForSecrets } from "./secret-scan-lib.js";

const requiredDocs = [
  "docs/deployment/render-deploy-rehearsal.md",
  "docs/deployment/render-env-checklist.md",
  "docs/deployment/render-post-deploy-verification.md",
  "docs/deployment/render-service-runbook.md",
];

await assertRenderYaml();
await assertFiles(requiredDocs);
await run("npm", ["run", "deploy:check"]);
await run("npm", ["run", "production:smoke"]);
await run("npm", ["run", "production:privacy-smoke"]);
const scan = await scanFilesForSecrets(["render.yaml", "docs/deployment", "README.md", "package.json", "services/voice-gateway/public"]);
console.log(JSON.stringify({ renderPreflight: "passed", secretFindings: scan.findings.length }, null, 2));
if (scan.findings.length > 0) process.exit(1);

async function assertRenderYaml(): Promise<void> {
  const yaml = await readFile("render.yaml", "utf8");
  const serviceNames = [...yaml.matchAll(/^\s+name:\s+(.+)$/gm)].map((match) => match[1]?.trim());
  const serviceTypes = [...yaml.matchAll(/^\s+- type:\s+(.+)$/gm)].map((match) => match[1]?.trim());
  for (const name of ["gorkh-api", "gorkh-voice-gateway", "gorkh-subagent-worker"]) {
    if (!serviceNames.includes(name)) throw new Error(`render.yaml missing ${name}`);
  }
  if (serviceTypes.filter((type) => type === "web").length !== 2 || serviceTypes.filter((type) => type === "worker").length !== 1) {
    throw new Error("render.yaml must define exactly two web services and one worker");
  }
  if (/sk-|dg_|xox|postgres:\/\/[^:\s]+:[^@\s]+@/i.test(yaml)) throw new Error("render.yaml appears to contain a real secret");
}

async function assertFiles(paths: string[]): Promise<void> {
  for (const path of paths) await stat(path);
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited ${code}`))));
  });
}
