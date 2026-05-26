import { extractProfileFactsFromText } from "../human/profile-extractor.js";

export function extractPreferenceFacts(text: string) {
  return extractProfileFactsFromText({ text }).filter((fact) => fact.kind === "preference" || fact.kind === "communication_style");
}
