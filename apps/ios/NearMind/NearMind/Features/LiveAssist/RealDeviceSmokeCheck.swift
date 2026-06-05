import Foundation

enum RealDeviceSmokeCheckStatus: String, Codable {
    case pending
    case running
    case passed
    case failed
    case skipped
}

enum RealDeviceSmokeCheckID: String, CaseIterable, Identifiable {
    case tokenStored
    case microphonePermissionGranted
    case gatewayConnected
    case conversationStarted
    case asrFinalReceived
    case assistantTextReceived
    case ttsSpoken
    case whisperStarted
    case cueReceived
    case bargeInTested
    case stopDiscarded
    case micStopped
    case ttsStopped
    case sessionStateFetched
    case latencySummaryFetched
    case noTokenInLogs
    case noRawAudioInLogs

    var id: String { rawValue }

    var title: String {
        switch self {
        case .tokenStored:
            return "Token stored"
        case .microphonePermissionGranted:
            return "Microphone permission granted"
        case .gatewayConnected:
            return "Gateway connected"
        case .conversationStarted:
            return "conversation_agent started"
        case .asrFinalReceived:
            return "ASR final received"
        case .assistantTextReceived:
            return "Assistant text received"
        case .ttsSpoken:
            return "TTS spoken"
        case .whisperStarted:
            return "whisper_copilot started"
        case .cueReceived:
            return "Cue received"
        case .bargeInTested:
            return "Barge-in tested"
        case .stopDiscarded:
            return "Stop save=false tested"
        case .micStopped:
            return "Mic stopped"
        case .ttsStopped:
            return "TTS stopped"
        case .sessionStateFetched:
            return "Session state fetched"
        case .latencySummaryFetched:
            return "Latency summary fetched"
        case .noTokenInLogs:
            return "No token in logs"
        case .noRawAudioInLogs:
            return "No raw audio in logs"
        }
    }
}

struct RealDeviceSmokeCheck: Identifiable, Equatable {
    let id: RealDeviceSmokeCheckID
    var title: String { id.title }
    var status: RealDeviceSmokeCheckStatus
    var detail: String
}

struct RealDeviceSmokeChecklist: Equatable {
    private(set) var checks: [RealDeviceSmokeCheck] = RealDeviceSmokeCheckID.allCases.map {
        RealDeviceSmokeCheck(id: $0, status: .pending, detail: "")
    }

    mutating func mark(_ id: RealDeviceSmokeCheckID, status: RealDeviceSmokeCheckStatus, detail: String = "") {
        guard let index = checks.firstIndex(where: { $0.id == id }) else { return }
        checks[index].status = status
        checks[index].detail = detail
    }

    func check(_ id: RealDeviceSmokeCheckID) -> RealDeviceSmokeCheck? {
        checks.first { $0.id == id }
    }
}
