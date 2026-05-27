import { db } from "../../db/client.js";
import { connectorConsentEvents, type ConnectorConsentEvent, type ConnectorProvider } from "../../db/schema.js";

export function connectorConsentText(provider: ConnectorProvider, scopes: string[]): string {
  const scopeSummary = scopes.length > 0 ? scopes.join(", ") : "no live scopes";
  return [
    `GORKH requests read-only connector access for ${provider}.`,
    `Scopes: ${scopeSummary}.`,
    "Tokens are not exposed to the LLM or frontend.",
    "External writes remain disabled in this milestone; GORKH can only draft or propose actions for review.",
  ].join(" ");
}

export async function recordConnectorConsentEvent(args: {
  userId: string;
  connectorAccountId?: string | null;
  provider: ConnectorProvider;
  scopes: string[];
  status: "shown" | "accepted" | "revoked" | "denied";
}): Promise<ConnectorConsentEvent> {
  const [event] = await db
    .insert(connectorConsentEvents)
    .values({
      userId: args.userId,
      connectorAccountId: args.connectorAccountId ?? null,
      provider: args.provider,
      scopes: args.scopes,
      consentText: connectorConsentText(args.provider, args.scopes),
      status: args.status,
    })
    .returning();
  if (!event) throw new Error("failed to record connector consent event");
  return event;
}
