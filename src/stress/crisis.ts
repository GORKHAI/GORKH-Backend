import { config } from "../config.js";

export function crisisResource(locale = config.STRESS_SUPPORT_DEFAULT_LOCALE): { name: string; description: string; locale: string } {
  const normalized = locale.toUpperCase();
  if (normalized === "US") {
    return {
      name: config.STRESS_SUPPORT_US_RESOURCE_NAME,
      description: config.STRESS_SUPPORT_US_RESOURCE_DESCRIPTION,
      locale: "US",
    };
  }
  return {
    name: config.STRESS_SUPPORT_FR_RESOURCE_NAME,
    description: config.STRESS_SUPPORT_FR_RESOURCE_DESCRIPTION,
    locale: "FR",
  };
}
