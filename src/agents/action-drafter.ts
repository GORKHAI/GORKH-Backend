export function draftFollowupMessage(input: { context: string; ask: string }): string {
  return `Draft for review: ${input.ask.trim()} Context: ${input.context.trim()}`.slice(0, 1200);
}
