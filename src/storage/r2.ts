import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { config, requireKey } from "../config.js";
import type { StorageProvider } from "./provider.js";

export function createR2StorageProvider(): StorageProvider {
  const accountId = requireKey(config.R2_ACCOUNT_ID, "R2_ACCOUNT_ID");
  const bucket = requireKey(config.R2_BUCKET, "R2_BUCKET");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireKey(config.R2_ACCESS_KEY_ID, "R2_ACCESS_KEY_ID"),
      secretAccessKey: requireKey(config.R2_SECRET_ACCESS_KEY, "R2_SECRET_ACCESS_KEY"),
    },
  });

  return {
    providerName: "r2",
    bucket,
    async putObject(params) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: params.key, Body: params.body, ContentType: params.contentType }));
      return { sizeBytes: params.body.byteLength, checksum: createHash("sha256").update(params.body).digest("hex") };
    },
    async getObject(params) {
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: params.key }));
      if (!result.Body) return Buffer.alloc(0);
      if (result.Body instanceof Readable) {
        const chunks: Buffer[] = [];
        for await (const chunk of result.Body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return Buffer.concat(chunks);
      }
      const body = result.Body as { transformToByteArray?: () => Promise<Uint8Array> };
      if (typeof body.transformToByteArray === "function") return Buffer.from(await body.transformToByteArray());
      return Buffer.from([]);
    },
    async deleteObject(params) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: params.key }));
    },
    async headObject(params) {
      const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: params.key }));
      return { sizeBytes: result.ContentLength ?? null, contentType: result.ContentType ?? null };
    },
    async createSignedDownloadUrl(params) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: params.key }), { expiresIn: params.expiresInSeconds });
    },
  };
}

