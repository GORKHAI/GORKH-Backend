const unsafeStressPhrases = [
  /\bdiagnos/i,
  /\btreatment plan\b/i,
  /\btherapy session\b/i,
  /\btrauma analysis\b/i,
  /\bI know how you feel\b/i,
  /\bmedication advice\b/i,
  /\bthey are lying\b/i,
];

export function assertStressSupportSafe(text: string): void {
  const hit = unsafeStressPhrases.find((pattern) => pattern.test(text));
  if (hit) throw new Error(`stress support text violates safety boundary: ${hit}`);
}

export function isSafeStressSupportText(text: string): boolean {
  return !unsafeStressPhrases.some((pattern) => pattern.test(text));
}
