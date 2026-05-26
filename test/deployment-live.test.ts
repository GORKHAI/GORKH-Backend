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

  it("declares ops and live verification scripts", async () => {
    const pkg = JSON.parse(await import("node:fs/promises").then((fs) => fs.readFile("package.json", "utf8"))) as { scripts: Record<string, string> };
    expect(pkg.scripts["live:verify:prod-safety"]).toBe("tsx src/scripts/live-verify-prod-safety.ts");
    expect(pkg.scripts["ops:console:check"]).toBe("tsx src/scripts/ops-console-check.ts");
    expect(pkg.scripts["ops:console:smoke"]).toBe("tsx src/scripts/ops-console-smoke.ts");
    expect(pkg.scripts["research:live:verify"]).toBe("tsx src/scripts/research-live-verify.ts");
    expect(pkg.scripts["subagents:live-research:verify"]).toBe("tsx src/scripts/subagents-live-research-verify.ts");
  });

  it("browser console code does not persist secrets in localStorage", async () => {
    const fs = await import("node:fs/promises");
    const live = await fs.readFile("services/voice-gateway/public/live-client.js", "utf8");
    const brain = await fs.readFile("services/voice-gateway/public/brain-console.js", "utf8");
    expect(live).not.toMatch(/localStorage|sessionStorage/);
    expect(brain).not.toMatch(/localStorage|sessionStorage/);
    expect(live).toContain("/ops/test-user");
    expect(brain).toContain("/ops/test-user");
  });
});
