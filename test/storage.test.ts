import { describe, expect, it } from "vitest";
import { buildStorageObjectKey, assertStorageKeyHasNoPii } from "../src/storage/keys.js";
import { createNoneStorageProvider } from "../src/storage/none.js";
import { StorageError } from "../src/storage/types.js";
import { redactForUserExport } from "../src/storage/redaction.js";

describe("NearMind hybrid storage policy", () => {
  it("builds object keys without names, emails, or raw titles", () => {
    const key = buildStorageObjectKey({
      userId: "11111111-1111-4111-8111-111111111111",
      ownerType: "session",
      ownerId: "22222222-2222-4222-8222-222222222222",
      objectType: "transcript",
      objectId: "33333333-3333-4333-8333-333333333333",
    });
    expect(key).toBe("nearmind/users/u_11111111-1111-4111-8111-111111111111/sessions/s_22222222-2222-4222-8222-222222222222/objects/o_33333333-3333-4333-8333-333333333333.json");
    expect(key).not.toContain("@");
    expect(key).not.toContain("bank");
    expect(() => assertStorageKeyHasNoPii(key)).not.toThrow();
  });

  it("rejects unsafe object key identifiers", () => {
    expect(() => buildStorageObjectKey({
      userId: "gorkh@example.com",
      ownerType: "session",
      ownerId: "doctor meeting",
      objectType: "transcript",
    })).toThrow(/not safe/i);
  });

  it("none provider returns storage_not_configured", async () => {
    await expect(createNoneStorageProvider().putObject({ key: "nearmind/test.json", body: Buffer.from("{}"), contentType: "application/json" }))
      .rejects
      .toMatchObject({ code: "storage_not_configured" } satisfies Partial<StorageError>);
  });

  it("redacts tokens and provider secrets from exports", () => {
    const redacted = redactForUserExport({
      token: "secret",
      nested: {
        oauthAccessToken: "oauth-secret",
        encryptedPayload: "cipher",
        safe: "visible",
      },
    }) as Record<string, unknown>;
    expect(redacted.token).toBe("[redacted]");
    expect((redacted.nested as Record<string, unknown>).oauthAccessToken).toBe("[redacted]");
    expect((redacted.nested as Record<string, unknown>).encryptedPayload).toBe("[redacted]");
    expect((redacted.nested as Record<string, unknown>).safe).toBe("visible");
  });
});

