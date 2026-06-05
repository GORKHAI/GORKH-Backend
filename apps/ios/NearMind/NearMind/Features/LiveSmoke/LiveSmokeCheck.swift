import Foundation

enum LiveSmokeCheckID: String, CaseIterable {
    case tokenStored
    case apiHealthReachable
    case gatewayConnected
    case conversationStartAck
    case conversationResponse
    case conversationStopSent
    case whisperStartAck
    case whisperCueReceived
    case whisperStopSaveFalse
    case mobileSyncFetched
    case sessionStateFetched
    case latencySummaryFetched
    case noCrash
}

enum LiveSmokeCheckStatus: String, Codable {
    case pending
    case running
    case passed
    case failed
    case skipped
}

struct LiveSmokeCheck: Identifiable, Equatable {
    let id: LiveSmokeCheckID
    let title: String
    var status: LiveSmokeCheckStatus
    var detail: String

    static let defaults: [LiveSmokeCheck] = [
        LiveSmokeCheck(id: .tokenStored, title: "Token stored", status: .pending, detail: "JWT must be saved in Keychain."),
        LiveSmokeCheck(id: .apiHealthReachable, title: "API health reachable", status: .pending, detail: "Calls production /health and /health/ready."),
        LiveSmokeCheck(id: .gatewayConnected, title: "Gateway connected", status: .pending, detail: "Connects to production /gateway/voice."),
        LiveSmokeCheck(id: .conversationStartAck, title: "Conversation start ack", status: .pending, detail: "Starts conversation_agent typed session."),
        LiveSmokeCheck(id: .conversationResponse, title: "Conversation response", status: .pending, detail: "Receives assistant, TTS instruction, or provider event."),
        LiveSmokeCheck(id: .conversationStopSent, title: "Conversation stop save=false", status: .pending, detail: "Stops without saving."),
        LiveSmokeCheck(id: .whisperStartAck, title: "Whisper start ack", status: .pending, detail: "Starts whisper_copilot typed session."),
        LiveSmokeCheck(id: .whisperCueReceived, title: "Whisper cue received", status: .pending, detail: "Receives voice_cue for APR transcript."),
        LiveSmokeCheck(id: .whisperStopSaveFalse, title: "Whisper stop save=false", status: .pending, detail: "Stops without saving."),
        LiveSmokeCheck(id: .mobileSyncFetched, title: "Mobile sync fetched", status: .pending, detail: "Fetches /mobile/sync."),
        LiveSmokeCheck(id: .sessionStateFetched, title: "Session state fetched", status: .pending, detail: "Fetches /mobile/sessions/:id/state when available."),
        LiveSmokeCheck(id: .latencySummaryFetched, title: "Latency summary fetched", status: .pending, detail: "Fetches /sessions/:id/latency-summary when available."),
        LiveSmokeCheck(id: .noCrash, title: "No crash", status: .passed, detail: "App remained responsive.")
    ]
}

struct LiveSmokeChecklist {
    private(set) var checks: [LiveSmokeCheck] = LiveSmokeCheck.defaults

    mutating func update(_ id: LiveSmokeCheckID, status: LiveSmokeCheckStatus, detail: String) {
        guard let index = checks.firstIndex(where: { $0.id == id }) else { return }
        checks[index].status = status
        checks[index].detail = detail
    }

    func check(_ id: LiveSmokeCheckID) -> LiveSmokeCheck? {
        checks.first { $0.id == id }
    }
}
