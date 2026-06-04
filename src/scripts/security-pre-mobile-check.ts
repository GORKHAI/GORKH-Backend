import { readFile } from "node:fs/promises";
import { scanFilesForSecrets } from "./secret-scan-lib.js";

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const files = {
  config: await readFile("src/config.ts", "utf8"),
  tools: await readFile("src/tools/permissions.ts", "utf8"),
  mcp: await readFile("src/connectors/mcp-adapter.ts", "utf8").catch(() => ""),
  gatewayPublicRoom: await readFile("services/voice-gateway/public/room.js", "utf8").catch(() => ""),
  gatewayPublicBrain: await readFile("services/voice-gateway/public/brain-console.js", "utf8").catch(() => ""),
  docsSecurity: await readFile("docs/security/pre-mobile-security-checklist.md", "utf8").catch(() => ""),
};

const secretScan = await scanFilesForSecrets(["render.yaml", "docs", "README.md", "package.json", "services/voice-gateway/public"]);
const checks: Check[] = [
  {
    name: "no_public_dev_consoles_by_default",
    ok: /OPS_CONSOLE_ENABLED.*default\(false\)/s.test(files.config),
    detail: "Ops console must remain disabled by default.",
  },
  {
    name: "no_shell_tools_allowed",
    ok: /execute_code/.test(files.tools) && /denied|dangerous/i.test(files.tools),
    detail: "Dangerous shell/code tool manifests must be denied.",
  },
  {
    name: "unrestricted_mcp_disabled",
    ok: /disabled|not_configured|allowlist|requires_manifest/i.test(files.mcp),
    detail: "MCP adapter must remain disabled/allowlist-only.",
  },
  {
    name: "no_raw_token_or_secret_in_public_js",
    ok: !/(API_SECRET|JWT_SECRET|DEEPGRAM_API_KEY|DEEPSEEK_API_KEY|TAVILY_API_KEY|LIVEKIT_API_SECRET)/.test(`${files.gatewayPublicRoom}\n${files.gatewayPublicBrain}`),
    detail: "Public browser bundles must not include server secrets.",
  },
  {
    name: "no_hidden_recording_default",
    ok: /ROOMS_RECORDING_ENABLED.*default\(false\)/s.test(files.config),
    detail: "Rooms recording must stay disabled by default.",
  },
  {
    name: "no_server_side_tts_default",
    ok: /VOICE_TTS_PROVIDER.*enum\(\[\"none\"\]\).*default\(\"none\"\)/s.test(files.config),
    detail: "Server-side TTS must stay unavailable by default.",
  },
  {
    name: "no_secret_scan_findings",
    ok: secretScan.findings.length === 0,
    detail: "No real-looking secrets in docs, public JS, render config, or package scripts.",
  },
  {
    name: "checklist_documented",
    ok: /no fake citations/i.test(files.docsSecurity) && /no hidden recording/i.test(files.docsSecurity),
    detail: "Pre-mobile security checklist must document the critical constraints.",
  },
];

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
}
if (secretScan.findings.length > 0) {
  for (const finding of secretScan.findings) console.error(`secret finding: ${finding.path}:${finding.line} rule=${finding.rule}`);
}
const ok = checks.every((check) => check.ok);
console.log(JSON.stringify({ ok, checks }, null, 2));
if (!ok) process.exit(1);
