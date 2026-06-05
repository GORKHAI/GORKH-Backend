import Foundation

struct ChatMessage: Identifiable, Equatable {
    enum Role: Equatable {
        case assistant
        case user
        case system
    }

    let id: UUID
    let role: Role
    let text: String
    let timestamp: Date

    init(id: UUID = UUID(), role: Role, text: String, timestamp: Date = Date()) {
        self.id = id
        self.role = role
        self.text = text
        self.timestamp = timestamp
    }
}

enum ChatQuickAction: String, CaseIterable, Identifiable {
    case today = "What should I do today?"
    case meetingPrep = "Prepare me for a meeting"
    case startLive = "Start Live Assist"
    case promises = "What did I promise?"
    case memory = "Show my memory"

    var id: String { rawValue }
}

struct ChatApproval: Identifiable, Equatable {
    enum Kind: Equatable {
        case openLive
        case muteVoiceReplies
        case openProfileMemory
    }

    enum RiskLevel: String, Equatable {
        case low = "Low"
        case sensitive = "Sensitive"
    }

    let id = UUID()
    let kind: Kind
    let title: String
    let explanation: String
    let confirmLabel: String
    let cancelLabel: String
    let riskLevel: RiskLevel?
}

struct ChatMemorySummary: Equatable {
    let confirmedCount: Int
    let pendingCount: Int
    let sensitiveCount: Int
    let summary: String?
}

protocol ChatAssistantServicing {
    func fetchTodayItems() async throws -> [MobileSyncItem]
    func fetchDashboard() async throws -> [String: JSONValue]
    func queryAssistant(text: String) async throws -> String
    func fetchMemorySummary() async throws -> ChatMemorySummary
}

extension APIClient: ChatAssistantServicing {
    func fetchTodayItems() async throws -> [MobileSyncItem] {
        try await getMobileSync(cursor: nil).decoded?.items ?? []
    }

    func fetchDashboard() async throws -> [String: JSONValue] {
        try await getBrainDashboard()
    }

    func queryAssistant(text: String) async throws -> String {
        let response = try await postBrainQuery(
            BrainQueryRequest(
                text: text,
                allowResearch: false,
                allowProfileContext: true,
                allowProfileMutation: false
            )
        )
        if let answer = response.decoded?.answer, !answer.isEmpty {
            return answer
        }
        if let message = response.decoded?.message, !message.isEmpty {
            return message
        }
        return "NearMind returned a response, but there was no answer text."
    }

    func fetchMemorySummary() async throws -> ChatMemorySummary {
        let response = try await getHumanProfileReview()
        let decoded = response.decoded
        return ChatMemorySummary(
            confirmedCount: decoded?.confirmedFacts?.count ?? 0,
            pendingCount: decoded?.proposedFacts?.count ?? 0,
            sensitiveCount: decoded?.sensitiveCandidates?.count ?? 0,
            summary: decoded?.profileSummary
        )
    }
}
