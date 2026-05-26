import type { VoiceState } from "./types.js";

const allowed: Record<VoiceState, VoiceState[]> = {
  starting: ["listening", "interrupted", "discarded"],
  listening: ["thinking", "speaking", "stopped", "interrupted", "discarded"],
  thinking: ["listening", "speaking", "stopped", "interrupted", "discarded"],
  speaking: ["listening", "stopped", "interrupted", "discarded"],
  stopped: [],
  interrupted: [],
  discarded: [],
};

export class VoiceStateMachine {
  state: VoiceState;
  currentSpeechId: string | null;

  constructor(state: VoiceState = "starting", currentSpeechId: string | null = null) {
    this.state = state;
    this.currentSpeechId = currentSpeechId;
  }

  transition(next: VoiceState): void {
    if (next === this.state) return;
    if (!allowed[this.state].includes(next)) {
      throw new Error(`Invalid voice state transition ${this.state} -> ${next}`);
    }
    this.state = next;
    if (!["speaking"].includes(next)) this.currentSpeechId = null;
  }

  startSpeech(speechId: string): void {
    this.transition("speaking");
    this.currentSpeechId = speechId;
  }

  cancelSpeech(): string | null {
    if (this.state !== "speaking" || !this.currentSpeechId) return null;
    const speechId = this.currentSpeechId;
    this.currentSpeechId = null;
    this.transition("listening");
    return speechId;
  }
}
