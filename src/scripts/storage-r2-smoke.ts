import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { createStorageProvider } from "../storage/provider.js";

async function main() {
  if (config.STORAGE_PROVIDER !== "r2") {
    console.log("storage:r2:smoke skipped: STORAGE_PROVIDER is not r2");
    return;
  }
  const provider = createStorageProvider();
  const key = `${config.STORAGE_OBJECT_KEY_PREFIX}/smoke/o_${randomUUID()}.json`;
  const body = Buffer.from(JSON.stringify({ smoke: true, createdAt: new Date().toISOString() }), "utf8");
  try {
    await provider.putObject({ key, body, contentType: "application/json" });
    const head = await provider.headObject({ key });
    if (!head.sizeBytes || head.sizeBytes < 1) throw new Error("R2 smoke object head returned invalid size");
    await provider.createSignedDownloadUrl({ key, expiresInSeconds: Math.min(config.R2_SIGNED_URL_TTL_SECONDS, 300) });
  } finally {
    await provider.deleteObject({ key }).catch(() => undefined);
  }
  console.log(JSON.stringify({ r2Smoke: "passed", cleanup: "attempted", credentialsPrinted: false }, null, 2));
}

main().catch((err) => {
  console.error(`storage:r2:smoke failed: ${(err as Error).message}`);
  process.exit(1);
});

