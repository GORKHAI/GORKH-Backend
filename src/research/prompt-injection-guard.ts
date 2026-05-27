export interface PromptInjectionAssessment {
  blocked: boolean;
  reasons: string[];
}

const suspiciousPatterns = [
  /\bignore (all )?(previous|prior|system|developer) instructions\b/i,
  /\breveal (the )?(system prompt|hidden prompt|secrets?|api keys?)\b/i,
  /\bexfiltrate\b/i,
  /\btool output is false\b/i,
  /\brun shell\b/i,
];

export function assessSourceForPromptInjection(text: string): PromptInjectionAssessment {
  const reasons = suspiciousPatterns.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
  return { blocked: reasons.length > 0, reasons };
}

export function sanitizeSourceText(text: string, maxChars = 8000): string {
  const assessment = assessSourceForPromptInjection(text);
  const clipped = text.replace(/\s+/g, " ").trim().slice(0, maxChars);
  return assessment.blocked ? `[Source text contained prompt-injection-like instructions and was summarized defensively.] ${clipped}` : clipped;
}
