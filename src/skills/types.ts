export interface SkillDraft {
  name: string;
  description: string;
  triggerPattern: string;
  steps: string[];
  riskLevel: "low" | "medium" | "high";
}
