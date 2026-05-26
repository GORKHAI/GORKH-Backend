import type { SearchProvider } from "./types.js";
import { ResearchProviderError } from "./types.js";

export const noneSearchProvider: SearchProvider = {
  name: "none",
  async search() {
    throw new ResearchProviderError("provider_not_configured", "Research provider is not configured");
  },
};
