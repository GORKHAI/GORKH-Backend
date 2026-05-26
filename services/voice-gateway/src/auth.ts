import type { FastifyRequest } from "fastify";
import { jwtVerify } from "jose";
import { gatewayConfig, requireGatewayKey } from "./config.js";

function secret(): Uint8Array {
  return new TextEncoder().encode(requireGatewayKey(gatewayConfig.JWT_SECRET, "JWT_SECRET"));
}

export function tokenFromRequest(request: FastifyRequest): string | null {
  const auth = request.headers.authorization;
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const query = request.query as { token?: string } | undefined;
  return query?.token ?? null;
}

export async function verifyGatewayToken(token: string): Promise<{ userId: string }> {
  const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
  if (!payload.sub) throw new Error("JWT subject is missing");
  return { userId: payload.sub };
}
