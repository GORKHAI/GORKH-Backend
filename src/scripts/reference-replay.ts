import { access, readFile } from "node:fs/promises";

const scenario = process.argv[2] ?? "odysseus-small-patterns";
if (scenario !== "odysseus-small-patterns") throw new Error(`unknown reference replay "${scenario}"`);

await access("odysseus-dev.zip");
const docs = await Promise.all([
  readFile("docs/reference/odysseus-small-patterns-for-nearmind.md", "utf8"),
  readFile("docs/brain/research-report-pack-v1.md", "utf8"),
  readFile("docs/brain/memory-skills-portability.md", "utf8"),
  readFile("docs/brain/reminder-channel-model.md", "utf8"),
  readFile("docs/security/pre-mobile-security-checklist.md", "utf8"),
]);
const combined = docs.join("\n");
for (const required of ["Research Report Pack", "Memory/Skills", "reminder", "shell tools", "unrestricted MCP"]) {
  if (!combined.toLowerCase().includes(required.toLowerCase())) throw new Error(`reference docs missing ${required}`);
}
console.log(
  JSON.stringify(
    {
      ok: true,
      reference: "odysseus-dev.zip",
      usedPatterns: ["research report structure", "memory/skills portability", "task reminder channels", "security checklist"],
      rejectedPatterns: ["self-hosted workspace", "shell tools", "file tools", "IMAP/SMTP sending", "CalDAV", "unrestricted MCP", "local model cookbook", "document editor"],
    },
    null,
    2,
  ),
);
