import { spawn } from "node:child_process";

const names = ["text-prep-bank", "text-whisper-bank", "text-prep-doctor", "text-whisper-doctor", "pcm-missing-asr"];

for (const name of names) {
  await run(name);
}

function run(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "gateway:replay", "--", name], { stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`gateway replay ${name} failed with exit ${code}`));
    });
    child.on("error", reject);
  });
}
