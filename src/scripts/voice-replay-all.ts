import { spawn } from "node:child_process";

for (const fixture of ["prep-bank", "whisper-bank", "prep-doctor", "whisper-doctor"]) {
  await run(fixture);
}

function run(fixture: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["./node_modules/.bin/tsx", "src/scripts/voice-replay.ts", fixture], {
      stdio: "inherit",
    });
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`voice replay ${fixture} exited with ${code}`));
    });
    child.once("error", reject);
  });
}
