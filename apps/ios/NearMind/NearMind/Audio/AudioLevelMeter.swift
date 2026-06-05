import AVFoundation

enum AudioLevelMeter {
    static func level(from buffer: AVAudioPCMBuffer) -> Double {
        guard let channelData = buffer.floatChannelData, buffer.frameLength > 0 else {
            return 0
        }

        let frameCount = Int(buffer.frameLength)
        let samples = channelData[0]
        var sum: Float = 0
        for index in 0..<frameCount {
            let sample = samples[index]
            sum += sample * sample
        }

        let rms = sqrt(sum / Float(frameCount))
        return min(1, max(0, Double(rms) * 6))
    }
}
