import { builtinToolManifests } from "./manifests.js";
import { decideToolPermission } from "./permissions.js";

export function listToolManifests() {
  return builtinToolManifests.map((manifest) => ({ ...manifest, permissionDecision: decideToolPermission(manifest) }));
}

export function findToolManifest(name: string) {
  return builtinToolManifests.find((manifest) => manifest.name === name) ?? null;
}
