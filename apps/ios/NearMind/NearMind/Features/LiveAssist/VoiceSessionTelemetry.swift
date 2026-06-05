import Foundation

struct VoiceSessionTelemetry: Equatable {
    private(set) var localMicStartedAt: Date?
    private(set) var firstASRFinalAt: Date?
    private(set) var firstCueAt: Date?
    private(set) var firstTTSInstructionAt: Date?
    private(set) var localTTSStartedAt: Date?

    mutating func recordMicStarted(at date: Date = Date()) {
        localMicStartedAt = date
    }

    mutating func recordFirstASRFinal(at date: Date = Date()) {
        if firstASRFinalAt == nil {
            firstASRFinalAt = date
        }
    }

    mutating func recordFirstCue(at date: Date = Date()) {
        if firstCueAt == nil {
            firstCueAt = date
        }
    }

    mutating func recordFirstTTSInstruction(at date: Date = Date()) {
        if firstTTSInstructionAt == nil {
            firstTTSInstructionAt = date
        }
    }

    mutating func recordLocalTTSStarted(at date: Date = Date()) {
        if localTTSStartedAt == nil {
            localTTSStartedAt = date
        }
    }

    mutating func reset() {
        localMicStartedAt = nil
        firstASRFinalAt = nil
        firstCueAt = nil
        firstTTSInstructionAt = nil
        localTTSStartedAt = nil
    }

    func rows() -> [String] {
        var rows: [String] = []
        if let value = delta(from: localMicStartedAt, to: firstASRFinalAt) {
            rows.append("Mic start -> first ASR final: \(format(value))")
        }
        if let value = delta(from: localMicStartedAt, to: firstCueAt) {
            rows.append("Mic start -> first cue: \(format(value))")
        }
        if let value = delta(from: firstTTSInstructionAt, to: localTTSStartedAt) {
            rows.append("TTS instruction -> local TTS start: \(format(value))")
        }
        return rows
    }

    private func delta(from start: Date?, to end: Date?) -> TimeInterval? {
        guard let start, let end else { return nil }
        return end.timeIntervalSince(start)
    }

    private func format(_ interval: TimeInterval) -> String {
        "\(Int(interval * 1000)) ms"
    }
}
