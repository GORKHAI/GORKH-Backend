import type { AgentRequestType } from "../db/schema.js";

export class RelayPolicyError extends Error {
  constructor(
    readonly code:
      | "relay_disabled"
      | "not_found"
      | "not_allowed"
      | "blocked"
      | "rate_limited"
      | "mass_broadcast_disabled"
      | "private_data_blocked"
      | "team_relay_future"
      | "external_send_disabled",
    message: string,
  ) {
    super(message);
  }
}

const privateKeys = ["memory", "calendar", "email", "gmail", "profile", "privateProfile", "accessToken", "secret", "providerKey", "deckAttachment"];

export function assertNoMassBroadcast(input: { recipientCount?: number; goal?: string }) {
  if ((input.recipientCount ?? 1) > 1) throw new RelayPolicyError("mass_broadcast_disabled", "Mass broadcast is not enabled for Relay v0.");
  if (/\b(my team|all investors|everyone|all contacts|broadcast)\b/i.test(input.goal ?? "")) {
    throw new RelayPolicyError("mass_broadcast_disabled", "Relay v0 supports one specific recipient at a time.");
  }
}

export function assertNoPrivateDataSharing(payload: Record<string, unknown>, label = "payload") {
  const serialized = JSON.stringify(payload).toLowerCase();
  for (const key of privateKeys) {
    if (serialized.includes(key.toLowerCase())) {
      throw new RelayPolicyError("private_data_blocked", `Relay v0 does not automatically share private ${label}.`);
    }
  }
}

export function assertRequestTypeAllowed(type: AgentRequestType) {
  if (type === "team_update_request") throw new RelayPolicyError("team_relay_future", "Team Relay is draft-only in v0.");
}

export function relayErrorStatus(err: RelayPolicyError): number {
  switch (err.code) {
  case "not_found":
    return 404;
  case "blocked":
  case "not_allowed":
  case "private_data_blocked":
  case "team_relay_future":
  case "external_send_disabled":
    return 403;
  case "rate_limited":
    return 429;
  default:
    return 400;
  }
}
