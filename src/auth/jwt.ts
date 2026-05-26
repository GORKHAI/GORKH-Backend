import { jwtVerify, SignJWT } from "jose";
import { config, requireKey } from "../config.js";

function secret(): Uint8Array {
  return new TextEncoder().encode(requireKey(config.JWT_SECRET, "JWT_SECRET"));
}

export async function signUserToken(userId: string, expiresIn = "30d"): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret());
}

export async function verifyUserToken(token: string): Promise<{ userId: string }> {
  const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
  if (!payload.sub) throw new Error("JWT subject is missing");
  return { userId: payload.sub };
}
