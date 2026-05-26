const { spawnSync } = await import("node:child_process");

for (const replay of ["bank-apr", "doctor-test-results", "company-brief"]) {
  console.log(`research:replay:${replay}`);
  const result = spawnSync("npm", ["run", "research:replay", "--", replay], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
