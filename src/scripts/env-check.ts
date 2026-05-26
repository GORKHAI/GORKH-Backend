import "dotenv/config";

type Service = "all" | "api" | "gateway" | "worker";

const service = ((process.argv[2] ?? "all") as Service).replace(/^--/, "") as Service;
const serviceChecks: Record<Exclude<Service, "all">, string[]> = {
  api: ["DATABASE_URL", "JWT_SECRET", "PORT", "HOST"],
  gateway: ["JWT_SECRET", "GORKH_BACKEND_HTTP_URL", "GORKH_BACKEND_WS_URL", "VOICE_GATEWAY_PORT", "VOICE_GATEWAY_HOST"],
  worker: ["DATABASE_URL", "JWT_SECRET", "SUBAGENT_RUNNER_MODE"],
};

const optional = [
  "REDIS_URL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "DEEPSEEK_API_KEY",
  "DEEPGRAM_API_KEY",
  "BRAVE_API_KEY",
  "TAVILY_API_KEY",
  "EXA_API_KEY",
];

const defaults: Record<string, string> = {
  HOST: "0.0.0.0",
  PORT: "8787",
  VOICE_GATEWAY_HOST: "0.0.0.0",
  VOICE_GATEWAY_PORT: "3010",
  GORKH_BACKEND_HTTP_URL: "http://127.0.0.1:3000",
  GORKH_BACKEND_WS_URL: "ws://127.0.0.1:3000",
  SUBAGENT_RUNNER_MODE: "db_worker",
};

const services = service === "all" ? (Object.keys(serviceChecks) as Array<Exclude<Service, "all">>) : [service as Exclude<Service, "all">];
let missingRequired = 0;
for (const name of services) {
  const required = serviceChecks[name];
  const status = required.map((key) => ({ key, present: present(key) }));
  missingRequired += status.filter((row) => !row.present).length;
  console.log(`${name}: ${status.map((row) => `${row.key}=${row.present ? "present" : "missing"}`).join(" ")}`);
  if (name === "worker" && process.env.SUBAGENT_RUNNER_MODE && process.env.SUBAGENT_RUNNER_MODE !== "db_worker") {
    console.log("worker: SUBAGENT_RUNNER_MODE should be db_worker for production worker deployment");
    missingRequired += 1;
  }
}
console.log(`optional: ${optional.map((key) => `${key}=${present(key) ? "present" : "missing"}`).join(" ")}`);
if (missingRequired > 0) process.exit(1);

function present(key: string): boolean {
  return Boolean(process.env[key]?.trim() || defaults[key]);
}
