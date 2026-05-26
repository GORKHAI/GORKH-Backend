export interface GatewayCounters {
  clientMessages: number;
  backendMessages: number;
  pcmFrames: number;
  asrFinals: number;
}

export function createCounters(): GatewayCounters {
  return { clientMessages: 0, backendMessages: 0, pcmFrames: 0, asrFinals: 0 };
}

export function nowIso(): string {
  return new Date().toISOString();
}
