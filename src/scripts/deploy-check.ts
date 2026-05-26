import "dotenv/config";
import { readFile } from "node:fs/promises";

const requiredFiles = ["render.yaml", "package.json", "dist/src/server.js", "dist/services/voice-gateway/src/server.js", "dist/src/subagents/worker-entry.js"];
const results: Record<string, string> = {};
for (const file of requiredFiles) {
  try {
    await readFile(file);
    results[file] = "present";
  } catch {
    results[file] = "missing";
  }
}
const env = {
  api: ["DATABASE_URL", "JWT_SECRET", "PORT", "HOST"].every(present),
  gateway: ["JWT_SECRET", "GORKH_BACKEND_HTTP_URL", "GORKH_BACKEND_WS_URL", "VOICE_GATEWAY_PORT", "VOICE_GATEWAY_HOST"].every(present),
  worker: ["DATABASE_URL", "JWT_SECRET"].every(present) && (process.env.SUBAGENT_RUNNER_MODE ?? "db_worker") === "db_worker",
};
console.log(JSON.stringify({ files: results, env, noSecretsPrinted: true }, null, 2));
if (Object.values(results).includes("missing") || !env.api || !env.worker) process.exit(1);

function present(key: string): boolean {
  const defaults: Record<string, string> = {
    HOST: "0.0.0.0",
    PORT: "8787",
    VOICE_GATEWAY_HOST: "0.0.0.0",
    VOICE_GATEWAY_PORT: "3010",
    GORKH_BACKEND_HTTP_URL: "http://127.0.0.1:3000",
    GORKH_BACKEND_WS_URL: "ws://127.0.0.1:3000",
    SUBAGENT_RUNNER_MODE: "db_worker",
  };
  return Boolean(process.env[key]?.trim() || defaults[key]);
}
