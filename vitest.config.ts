import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "services/voice-gateway/test/**/*.test.ts"],
    exclude: ["test/**/*.integration.test.ts", "services/voice-gateway/test/**/*.integration.test.ts"],
  },
});
