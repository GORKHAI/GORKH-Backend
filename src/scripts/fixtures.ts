export type FixtureName = "bank" | "meeting" | "doctor";

export interface ReplayFixture {
  description: string;
  userGoal: string;
  title: string;
  participants: string[];
  lines: Array<{ speaker: string; text: string; offsetMs: number }>;
}

export const fixtures: Record<FixtureName, ReplayFixture> = {
  bank: {
    description: "I am going to the bank to discuss a loan.",
    userGoal: "Understand loan terms and avoid hidden fees.",
    title: "Bank loan meeting",
    participants: ["bank worker"],
    lines: [
      { speaker: "speaker_1", text: "The APR is 9.4 percent and there is an arrangement fee.", offsetMs: 1000 },
      { speaker: "speaker_1", text: "The rate is fixed for two years and then variable.", offsetMs: 4000 },
      { speaker: "speaker_1", text: "There is optional insurance, but most customers take it.", offsetMs: 7000 },
      { speaker: "speaker_1", text: "If you want this rate you can sign today.", offsetMs: 10000 },
    ],
  },
  meeting: {
    description: "I have a business meeting with a partner about the project.",
    userGoal: "Capture decisions, owners, and deadlines.",
    title: "Partner project meeting",
    participants: ["partner"],
    lines: [
      { speaker: "speaker_1", text: "We agreed to move forward with the smaller launch.", offsetMs: 1000 },
      { speaker: "me", text: "I'll send the revised proposal tomorrow.", offsetMs: 3000 },
      { speaker: "speaker_1", text: "Let's follow up soon on pricing.", offsetMs: 6000 },
    ],
  },
  doctor: {
    description: "I have a doctor appointment about blood test results.",
    userGoal: "Understand results and next steps.",
    title: "Blood test appointment",
    participants: ["doctor"],
    lines: [
      { speaker: "speaker_1", text: "Your blood test results show elevated cholesterol.", offsetMs: 1000 },
      { speaker: "speaker_1", text: "We should discuss medication and possible side effects.", offsetMs: 4000 },
      { speaker: "speaker_1", text: "Please schedule a follow-up appointment in three months.", offsetMs: 7000 },
    ],
  },
};

export function getFixture(name: string): ReplayFixture {
  const fixture = fixtures[name as FixtureName];
  if (!fixture) throw new Error(`unknown fixture "${name}"; use bank, meeting, or doctor`);
  return fixture;
}
