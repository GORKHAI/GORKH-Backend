import { config } from "../config.js";
import { closeDb } from "../db/client.js";
import { closeRedis } from "../redis.js";
import { currentWorkerId } from "./queue.js";
import { processDueSubagentTasksOnce } from "./worker.js";

let stopping = false;

export async function runDurableSubagentWorker(): Promise<void> {
  const workerId = currentWorkerId();
  console.log(`worker:start workerId=${workerId} runnerMode=${config.SUBAGENT_RUNNER_MODE}`);
  installShutdownHandlers();
  while (!stopping) {
    try {
      await processDueSubagentTasksOnce({ workerId });
    } catch (err) {
      console.error(`worker:batch_failed message=${redact((err as Error).message)}`);
    }
    await delay(config.SUBAGENT_WORKER_POLL_MS);
  }
  await closeRedis().catch(() => undefined);
  await closeDb().catch(() => undefined);
  console.log(`worker:stopped workerId=${workerId}`);
}

function installShutdownHandlers(): void {
  const stop = () => {
    stopping = true;
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  process.once("uncaughtException", (err) => {
    console.error(`worker:uncaught_exception message=${redact(err.message)}`);
    stopping = true;
  });
  process.once("unhandledRejection", (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    console.error(`worker:unhandled_rejection message=${redact(message)}`);
    stopping = true;
  });
}

function redact(message: string): string {
  return message.replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]").replace(/([A-Z0-9_]*KEY|TOKEN|SECRET)=\S+/gi, "$1=[redacted]");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  runDurableSubagentWorker().catch((err) => {
    console.error(`worker:fatal message=${redact((err as Error).message)}`);
    process.exit(1);
  });
}
