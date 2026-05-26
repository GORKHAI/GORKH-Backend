import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanFilesForSecrets } from "../src/scripts/secret-scan-lib.js";

describe("render deployment rehearsal helpers", () => {
  it("render.yaml declares exactly three expected services", async () => {
    const text = await import("node:fs/promises").then((fs) => fs.readFile("render.yaml", "utf8"));
    const names = [...text.matchAll(/^\s+name:\s+(.+)$/gm)].map((match) => match[1]?.trim());
    const types = [...text.matchAll(/^\s+- type:\s+(.+)$/gm)].map((match) => match[1]?.trim());
    expect(names).toEqual(["gorkh-api", "gorkh-voice-gateway", "gorkh-subagent-worker"]);
    expect(types).toEqual(["web", "web", "worker"]);
    expect(text).toContain("healthCheckPath: /health/ready");
    expect(text).toContain("startCommand: npm run worker:start");
  });

  it("secret scan reports fake secrets without printing values", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gorkh-secret-scan-"));
    const file = join(dir, "sample.md");
    await writeFile(file, "JWT_SECRET=super-secret-value-that-should-be-detected\n");
    const scan = await scanFilesForSecrets([file]);
    expect(scan.findings).toEqual([{ path: file, rule: "jwt_secret_assignment", line: 1 }]);
    expect(JSON.stringify(scan.findings)).not.toContain("super-secret-value");
  });
});
