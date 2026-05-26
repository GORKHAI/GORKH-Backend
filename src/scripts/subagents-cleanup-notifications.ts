import { cleanupSubagentNotifications } from "../subagents/notifications.js";

async function main(): Promise<void> {
  const deleted = await cleanupSubagentNotifications();
  console.log(`subagents:queue:cleanup-notifications deleted=${deleted}`);
}

main().catch((err) => {
  console.error(`subagents:queue:cleanup-notifications failed: ${(err as Error).message}`);
  process.exit(1);
});
