import AVFoundation
import Foundation

enum AudioStreamingError: Error, LocalizedError, Equatable {
    case consentRequired
    case sessionNotActive
    case conversionUnavailable
    case conversionFailed

    var errorDescription: String? {
        switch self {
        case .consentRequired:
            return "Check consent before starting the microphone."
        case .sessionNotActive:
            return "Start a gateway session before starting the microphone."
        case .conversionUnavailable:
            return "NearMind could not prepare PCM16 audio conversion."
        case .conversionFailed:
            return "NearMind could not convert microphone audio to PCM16."
        }
    }
}

protocol PCM16AudioStreaming: AnyObject {
    var isRunning: Bool { get }
    func start(
        consentGranted: Bool,
        sessionActive: Bool,
        onLevel: @escaping @Sendable (Double) -> Void,
        onFrame: @escaping @Sendable (Data) -> Void,
        onError: @escaping @Sendable (Error) -> Void
    ) throws
    func stop()
}

final class PCM16AudioStreamer: PCM16AudioStreaming {
    private let engine = AVAudioEngine()
    private let audioSessionManager: AudioSessionManager
    private let outputFormat = AVAudioFormat(
        commonFormat: .pcmFormatInt16,
        sampleRate: 16_000,
        channels: 1,
        interleaved: true
    )
    private var converter: AVAudioConverter?
    private(set) var isRunning = false

    init(audioSessionManager: AudioSessionManager = AudioSessionManager()) {
        self.audioSessionManager = audioSessionManager
    }

    func start(
        consentGranted: Bool,
        sessionActive: Bool,
        onLevel: @escaping @Sendable (Double) -> Void,
        onFrame: @escaping @Sendable (Data) -> Void,
        onError: @escaping @Sendable (Error) -> Void
    ) throws {
        guard consentGranted else { throw AudioStreamingError.consentRequired }
        guard sessionActive else { throw AudioStreamingError.sessionNotActive }
        guard let outputFormat else { throw AudioStreamingError.conversionUnavailable }

        if isRunning {
            stop()
        }

        try audioSessionManager.configureForVoiceSession()

        let inputNode = engine.inputNode
        let inputFormat = inputNode.outputFormat(forBus: 0)
        guard let converter = AVAudioConverter(from: inputFormat, to: outputFormat) else {
            audioSessionManager.deactivate()
            throw AudioStreamingError.conversionUnavailable
        }
        self.converter = converter

        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: inputFormat) { [weak self] buffer, _ in
            guard let self else { return }
            onLevel(AudioLevelMeter.level(from: buffer))
            do {
                let frame = try self.convert(buffer, outputFormat: outputFormat)
                if !frame.isEmpty {
                    onFrame(frame)
                }
            } catch {
                onError(error)
            }
        }

        engine.prepare()
        try engine.start()
        isRunning = true
    }

    func stop() {
        guard isRunning || engine.isRunning else {
            audioSessionManager.deactivate()
            return
        }
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        converter = nil
        isRunning = false
        audioSessionManager.deactivate()
    }

    private func convert(_ buffer: AVAudioPCMBuffer, outputFormat: AVAudioFormat) throws -> Data {
        guard let converter else {
            throw AudioStreamingError.conversionUnavailable
        }

        let ratio = outputFormat.sampleRate / buffer.format.sampleRate
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 1
        guard let outputBuffer = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: capacity) else {
            throw AudioStreamingError.conversionUnavailable
        }

        var didProvideInput = false
        var conversionError: NSError?
        let status = converter.convert(to: outputBuffer, error: &conversionError) { _, inputStatus in
            if didProvideInput {
                inputStatus.pointee = .noDataNow
                return nil
            }
            didProvideInput = true
            inputStatus.pointee = .haveData
            return buffer
        }

        if status == .error || conversionError != nil {
            throw conversionError ?? AudioStreamingError.conversionFailed
        }

        let audioBuffer = outputBuffer.audioBufferList.pointee.mBuffers
        guard let dataPointer = audioBuffer.mData, audioBuffer.mDataByteSize > 0 else {
            return Data()
        }
        return Data(bytes: dataPointer, count: Int(audioBuffer.mDataByteSize))
    }
}
