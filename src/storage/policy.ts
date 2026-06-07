import { config } from "../config.js";
import { StorageError } from "./types.js";

export function assertStorageConfigured(): void {
  if (config.STORAGE_PROVIDER === "none") {
    throw new StorageError("storage_not_configured", "Long-term object storage is not configured.", 503);
  }
}

export function assertObjectSizeAllowed(sizeBytes: number): void {
  if (sizeBytes > config.STORAGE_MAX_OBJECT_BYTES) {
    throw new StorageError("storage_object_too_large", `Object exceeds max size of ${config.STORAGE_MAX_OBJECT_BYTES} bytes.`, 413);
  }
}

export function canArchiveTranscript(): boolean {
  return config.STORAGE_PROVIDER !== "none" && config.STORAGE_TRANSCRIPT_ARCHIVE_ENABLED;
}

export function canExportUserData(): boolean {
  return config.STORAGE_PROVIDER !== "none" && config.STORAGE_EXPORTS_ENABLED;
}

