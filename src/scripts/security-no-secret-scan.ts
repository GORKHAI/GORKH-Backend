import { scanFilesForSecrets } from "./secret-scan-lib.js";

const scan = await scanFilesForSecrets(["render.yaml", "docs/deployment", "README.md", "package.json", "services/voice-gateway/public"]);
for (const finding of scan.findings) {
  console.error(`secret-scan finding: ${finding.path}:${finding.line} rule=${finding.rule}`);
}
console.log(JSON.stringify({ ok: scan.findings.length === 0, findings: scan.findings }, null, 2));
if (scan.findings.length > 0) process.exit(1);
