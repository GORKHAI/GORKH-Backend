import { config } from "../config.js";
import { createNoneStorageProvider } from "./none.js";
import { createR2StorageProvider } from "./r2.js";

export interface PutObjectParams {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface GetObjectParams {
  key: string;
}

export interface DeleteObjectParams {
  key: string;
}

export interface HeadObjectParams {
  key: string;
}

export interface SignedDownloadUrlParams {
  key: string;
  expiresInSeconds: number;
}

export interface StorageProvider {
  providerName: "none" | "r2";
  bucket: string | null;
  putObject(params: PutObjectParams): Promise<{ sizeBytes: number; checksum?: string | null }>;
  getObject(params: GetObjectParams): Promise<Buffer>;
  deleteObject(params: DeleteObjectParams): Promise<void>;
  headObject(params: HeadObjectParams): Promise<{ sizeBytes: number | null; contentType?: string | null }>;
  createSignedDownloadUrl(params: SignedDownloadUrlParams): Promise<string>;
}

export function createStorageProvider(): StorageProvider {
  if (config.STORAGE_PROVIDER === "r2") return createR2StorageProvider();
  return createNoneStorageProvider();
}

export function storageProviderStatus() {
  return {
    provider: config.STORAGE_PROVIDER,
    configured: config.STORAGE_PROVIDER === "r2" ? Boolean(config.R2_ACCOUNT_ID && config.R2_ACCESS_KEY_ID && config.R2_SECRET_ACCESS_KEY && config.R2_BUCKET) : false,
    exportsEnabled: config.STORAGE_EXPORTS_ENABLED,
    transcriptArchiveEnabled: config.STORAGE_TRANSCRIPT_ARCHIVE_ENABLED,
    audioSaveDefault: config.STORAGE_AUDIO_SAVE_DEFAULT,
    maxObjectBytes: config.STORAGE_MAX_OBJECT_BYTES,
  };
}

