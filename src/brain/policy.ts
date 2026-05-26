export function canReflectOnSessionStatus(status: string): boolean {
  return status === "saved";
}

export function brainBoundaryText(): string {
  return [
    "GORKH v0 does not fine-tune model weights.",
    "It improves through confirmed profile facts, feedback, proposed skills, and reflection.",
    "Sensitive psychological facts require opt-in and confirmation.",
    "No autonomous financial, legal, medical, messaging, purchase, browser-login, form-submit, or code-execution actions are allowed.",
  ].join(" ");
}
