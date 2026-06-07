import type { StorageProvider } from "./provider.js";
import { StorageError } from "./types.js";

function notConfigured(): never {
  throw new StorageError("storage_not_configured", "Long-term object storage is not configured.", 503);
}

export function createNoneStorageProvider(): StorageProvider {
  return {
    providerName: "none",
    bucket: null,
    async putObject() {
      return notConfigured();
    },
    async getObject() {
      return notConfigured();
    },
    async deleteObject() {
      return notConfigured();
    },
    async headObject() {
      return notConfigured();
    },
    async createSignedDownloadUrl() {
      return notConfigured();
    },
  };
}

