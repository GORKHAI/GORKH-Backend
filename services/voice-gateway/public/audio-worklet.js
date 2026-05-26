class Pcm16CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetRate = 16000;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input || input.length === 0) return true;
    const downsampled = this.downsample(input, sampleRate, this.targetRate);
    const pcm = new Int16Array(downsampled.length);
    let level = 0;
    for (let i = 0; i < downsampled.length; i++) {
      const sample = Math.max(-1, Math.min(1, downsampled[i] || 0));
      level += Math.abs(sample);
      pcm[i] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
    }
    this.port.postMessage({ type: "pcm", buffer: pcm.buffer, level: downsampled.length ? level / downsampled.length : 0 }, [pcm.buffer]);
    return true;
  }

  downsample(input, sourceRate, targetRate) {
    if (sourceRate === targetRate) return input;
    const ratio = sourceRate / targetRate;
    const output = new Float32Array(Math.max(1, Math.floor(input.length / ratio)));
    for (let i = 0; i < output.length; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.min(input.length, Math.floor((i + 1) * ratio));
      let sum = 0;
      let count = 0;
      for (let j = start; j < end; j++) {
        sum += input[j] || 0;
        count++;
      }
      output[i] = count ? sum / count : 0;
    }
    return output;
  }
}

registerProcessor("pcm16-capture", Pcm16CaptureProcessor);
