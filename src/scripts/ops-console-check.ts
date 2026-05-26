import { gatewayConfig } from "../../services/voice-gateway/src/config.js";
import { printSummary, runCheck } from "./live-verify-utils.js";

const checks = [
  await runCheck("ops console config", async () => ({
    enabled: gatewayConfig.OPS_CONSOLE_ENABLED,
    adminTokenConfigured: Boolean(gatewayConfig.OPS_CONSOLE_ADMIN_TOKEN),
    ttlSeconds: gatewayConfig.OPS_CONSOLE_SESSION_TTL_SECONDS,
  })),
  await runCheck("ops console default safe", async () => {
    if (gatewayConfig.OPS_CONSOLE_ENABLED && !gatewayConfig.OPS_CONSOLE_ADMIN_TOKEN) throw new Error("OPS_CONSOLE_ENABLED requires OPS_CONSOLE_ADMIN_TOKEN");
    return { protectedWhenEnabled: true, publicByDefault: false };
  }),
];

printSummary("ops:console:check", checks);
