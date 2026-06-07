import { z } from "zod";

export const storageOwnerTypeSchema = z.enum(["session", "room", "document", "email", "research", "export", "memory", "calendar", "outreach", "relay"]);
export const storageObjectTypeSchema = z.enum(["transcript", "audio", "document", "attachment", "export", "report", "snapshot", "summary_json"]);
export const storageSensitivitySchema = z.enum(["low", "medium", "high", "sensitive"]);
export const storageRetentionPolicySchema = z.enum(["temporary", "standard", "archive", "delete_on_discard", "user_controlled"]);

export type StorageOwnerType = z.infer<typeof storageOwnerTypeSchema>;
export type StorageObjectType = z.infer<typeof storageObjectTypeSchema>;
export type StorageSensitivity = z.infer<typeof storageSensitivitySchema>;
export type StorageRetentionPolicy = z.infer<typeof storageRetentionPolicySchema>;

export interface StoragePutParams {
  userId: string;
  ownerType: StorageOwnerType;
  ownerId: string;
  objectType: StorageObjectType;
  contentType: string;
  body: Buffer;
  sensitivity?: StorageSensitivity;
  retentionPolicy?: StorageRetentionPolicy;
}

export interface StoredObjectSummary {
  id: string;
  ownerType: StorageOwnerType;
  ownerId: string;
  objectType: StorageObjectType;
  provider: "r2" | "none";
  contentType: string | null;
  sizeBytes: number | null;
  sensitivity: StorageSensitivity;
  retentionPolicy: StorageRetentionPolicy;
  status: "active" | "archived" | "deleted" | "failed";
  createdAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
}

export interface PublicStorageUsage {
  totalBytes: number;
  transcriptBytes: number;
  audioBytes: number;
  documentBytes: number;
  exportBytes: number;
  reportBytes: number;
  updatedAt: string | null;
}

export class StorageError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

