import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import type { StorageObjectType, StorageOwnerType } from "./types.js";

const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ownerSegments: Record<StorageOwnerType, string> = {
  session: "sessions",
  room: "rooms",
  document: "documents",
  email: "emails",
  research: "research",
  export: "exports",
  memory: "memory",
  calendar: "calendar",
  outreach: "outreach",
  relay: "relay",
};

const objectExtensions: Record<StorageObjectType, string> = {
  transcript: "json",
  audio: "bin",
  document: "bin",
  attachment: "bin",
  export: "json",
  report: "json",
  snapshot: "json",
  summary_json: "json",
};

export function buildStorageObjectKey(args: {
  userId: string;
  ownerType: StorageOwnerType;
  ownerId: string;
  objectType: StorageObjectType;
  objectId?: string;
}): string {
  assertSafeId(args.userId, "userId");
  assertSafeId(args.ownerId, "ownerId");
  const objectId = args.objectId ?? randomUUID();
  assertSafeId(objectId, "objectId");
  const prefix = sanitizePrefix(config.STORAGE_OBJECT_KEY_PREFIX);
  const user = `u_${args.userId}`;
  const owner = `${ownerPrefix(args.ownerType)}_${args.ownerId}`;
  const object = `o_${objectId}.${objectExtensions[args.objectType]}`;
  return `${prefix}/users/${user}/${ownerSegments[args.ownerType]}/${owner}/objects/${object}`;
}

export function assertStorageKeyHasNoPii(key: string): void {
  if (/@/.test(key)) throw new Error("storage object key must not contain email addresses");
  if (/\s/.test(key)) throw new Error("storage object key must not contain whitespace or raw titles");
  if (/[^a-zA-Z0-9/_\-.]/.test(key)) throw new Error("storage object key contains unsupported characters");
}

function ownerPrefix(ownerType: StorageOwnerType): string {
  if (ownerType === "session") return "s";
  if (ownerType === "room") return "r";
  if (ownerType === "export") return "e";
  if (ownerType === "research") return "q";
  return "ref";
}

function sanitizePrefix(value: string): string {
  return value.replace(/[^a-zA-Z0-9/_-]/g, "").replace(/^\/+|\/+$/g, "") || "nearmind";
}

function assertSafeId(value: string, label: string): void {
  if (uuidLike.test(value)) return;
  if (/^[a-zA-Z0-9_-]{8,80}$/.test(value)) return;
  throw new Error(`${label} is not safe for object keys`);
}

