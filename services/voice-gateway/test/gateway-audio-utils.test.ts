import { describe, expect, it } from "vitest";
import { clampSample, downsampleFloat32, floatToPcm16 } from "../src/browser/audio-utils.js";

describe("gateway browser audio utilities", () => {
  it("clamps PCM samples correctly", () => {
    expect(clampSample(2)).toBe(1);
    expect(clampSample(-2)).toBe(-1);
    expect(clampSample(Number.NaN)).toBe(0);
  });

  it("converts float samples to PCM16", () => {
    const pcm = floatToPcm16(new Float32Array([-1, 0, 1]));
    expect([...pcm]).toEqual([-32768, 0, 32767]);
  });

  it("downsamples to a valid 16kHz-ish frame length", () => {
    const input = new Float32Array(480).fill(0.5);
    const output = downsampleFloat32(input, 48000, 16000);
    expect(output.length).toBe(160);
    expect(output[0]).toBeCloseTo(0.5);
  });
});
