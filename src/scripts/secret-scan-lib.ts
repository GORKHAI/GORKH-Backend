import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export interface SecretFinding {
  path: string;
  rule: string;
  line: number;
}

const rules: Array<{ name: string; pattern: RegExp }> = [
  { name: "private_key", pattern: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: "jwt_secret_assignment", pattern: /JWT_SECRET\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{24,}/ },
  { name: "database_password_url", pattern: /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i },
  { name: "upstash_token", pattern: /(UPSTASH_REDIS_REST_TOKEN|upstash)[^A-Za-z0-9]+[A-Za-z0-9_=-]{24,}/i },
  { name: "deepgram_key", pattern: /(DEEPGRAM_API_KEY|deepgram)[^A-Za-z0-9]+[A-Za-z0-9_-]{24,}/i },
  { name: "deepseek_key", pattern: /(DEEPSEEK_API_KEY|deepseek)[^A-Za-z0-9]+sk-[A-Za-z0-9_-]{20,}/i },
  { name: "research_provider_key", pattern: /(TAVILY_API_KEY|BRAVE_API_KEY|EXA_API_KEY)[^A-Za-z0-9]+[A-Za-z0-9_-]{24,}/i },
];

export async function scanFilesForSecrets(paths: string[]): Promise<{ findings: SecretFinding[] }> {
  const files = (await Promise.all(paths.map((path) => expand(path)))).flat();
  const findings: SecretFinding[] = [];
  for (const file of files) {
    const text = await readFile(file, "utf8").catch(() => "");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const rule of rules) {
        if (rule.pattern.test(line) && !isAllowedPlaceholder(line)) {
          findings.push({ path: file, rule: rule.name, line: index + 1 });
        }
      }
    });
  }
  return { findings };
}

async function expand(path: string): Promise<string[]> {
  const info = await stat(path).catch(() => null);
  if (!info) return [];
  if (info.isFile()) return [path];
  if (!info.isDirectory()) return [];
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "dist")
      .map((entry) => expand(join(path, entry.name))),
  );
  return nested.flat();
}

function isAllowedPlaceholder(line: string): boolean {
  return /sync:\s*false|<.*>|placeholder|LIVE_TEST_JWT=|JWT_SECRET=<generated|API_KEY=$|TOKEN=$/.test(line);
}
