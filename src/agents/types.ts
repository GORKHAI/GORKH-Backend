export interface AgentDecision<T = unknown> {
  agent: string;
  output: T;
  safetyChecked: boolean;
}
