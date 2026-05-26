import { connectorManifests } from "./manifests.js";
import type { ConnectorId, ConnectorManifest } from "./types.js";

export function listConnectorManifests(): ConnectorManifest[] {
  return connectorManifests;
}

export function getConnectorManifest(id: ConnectorId | string): ConnectorManifest | null {
  return connectorManifests.find((manifest) => manifest.id === id) ?? null;
}
