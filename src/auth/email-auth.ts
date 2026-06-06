import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { authDisabledError, authError } from "./auth-errors.js";

export function registerEmailAuthRoutes(app: FastifyInstance) {
  app.post("/auth/email/start", async (_, reply) => {
    if (!config.EMAIL_AUTH_ENABLED) return reply.code(501).send(authDisabledError("email"));
    if (config.EMAIL_AUTH_PROVIDER === "none") {
      return reply.code(501).send(authError("email_provider_not_configured", "Email sign-in provider is not configured.", { provider: "none" }));
    }
    return reply.code(501).send(authError("email_provider_not_configured", "Email sign-in provider is not configured.", { provider: config.EMAIL_AUTH_PROVIDER }));
  });

  app.post("/auth/email/verify", async (_, reply) => {
    if (!config.EMAIL_AUTH_ENABLED) return reply.code(501).send(authDisabledError("email"));
    if (config.EMAIL_AUTH_PROVIDER === "none") {
      return reply.code(501).send(authError("email_provider_not_configured", "Email sign-in provider is not configured.", { provider: "none" }));
    }
    return reply.code(501).send(authError("email_provider_not_configured", "Email sign-in provider is not configured.", { provider: config.EMAIL_AUTH_PROVIDER }));
  });
}
