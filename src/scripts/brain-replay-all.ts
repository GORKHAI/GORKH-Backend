const replays = [
  "local-reference-inventory",
  "implementation-audit-summary",
  "profile-explicit",
  "profile-inferred-proposed",
  "profile-review",
  "stress-support",
  "stress-crisis-boundary",
  "stress-settings",
  "skill-proposal",
  "skill-match",
  "reflection-review",
  "research-needed-no-provider",
  "research-provider-status",
  "tool-registry",
  "dashboard",
  "voice-profile-adaptation",
  "console-smoke",
  "research-check",
  "research-live-if-configured",
  "profile-control-surface",
  "skill-control-surface",
  "stress-control-surface",
  "audit-control-surface",
];

for (const replay of replays) {
  console.log(`brain:replay:${replay}`);
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync("npm", ["run", "brain:replay", "--", replay], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
