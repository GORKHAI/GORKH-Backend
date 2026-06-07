import { config } from "../config.js";
import { storageProviderStatus } from "../storage/provider.js";

function main() {
  const status = storageProviderStatus();
  if (config.STORAGE_PROVIDER === "r2" && !status.configured) {
    throw new Error("STORAGE_PROVIDER=r2 but one or more R2 env vars are missing");
  }
  console.log(JSON.stringify({ storage: status, secretsPrinted: false }, null, 2));
}

main();

