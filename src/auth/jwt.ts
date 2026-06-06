import { jwtVerify, SignJWT } from "jose";
import { config, requireKey } from "../config.js";

function secret(): Uint8Array {
  return new TextEncoder().encode(requireKey(config.JWT_SECRET, "JWT_SECRET"));
}

export async function signUserToken(userId: string, expiresIn = "30d", tokenId?: string): Promise<string> {
  let jwt = new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(expiresIn);
  if (tokenId) jwt = jwt.setJti(tokenId);
  return jwt.sign(secret());
}

export async function verifyUserToken(token: string): Promise<{ userId: string; tokenId?: string }> {
  const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
  if (!payload.sub) throw new Error("JWT subject is missing");
  return { userId: payload.sub, tokenId: payload.jti };
}
