import { buildSituationBrief } from "../situation/brief.js";

export function analyzeSituationText(description: string) {
  return buildSituationBrief({ description });
}
