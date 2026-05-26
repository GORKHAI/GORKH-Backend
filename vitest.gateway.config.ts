import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["services/voice-gateway/test/**/*.test.ts"],
    exclude: ["services/voice-gateway/test/**/*.integration.test.ts"],
  },
});
