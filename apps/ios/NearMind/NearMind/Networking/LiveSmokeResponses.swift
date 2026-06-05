import Foundation

struct HealthResponse: Codable, Equatable {
    let ok: Bool?
    let db: Bool?
    let redis: Bool?
    let providers: [String: JSONValue]?
}

struct MobileSyncResponse: Codable, Equatable {
    let cursor: String?
    let items: [MobileSyncItem]
    let hasMore: Bool?
}

struct MobileSyncItem: Codable, Equatable {
    let type: String
    let item: [String: JSONValue]
}

struct SessionStateResponse: Codable, Equatable {
    let sessionId: String
    let status: String
    let voiceState: VoiceStateResponse?
    let retentionPolicy: String
    let counts: [String: JSONValue]?
    let canResume: Bool?
    let resumeReason: String?
    let lastEventCursor: String?
}

struct VoiceStateResponse: Codable, Equatable {
    let voiceSessionId: String
    let state: String
    let policy: String
    let inputKind: String
    let outputKind: String
}

struct LatencySummaryResponse: Codable, Equatable {
    let sessionId: String
    let latencySummary: [String: JSONValue]
}

struct BrainQueryRequest: Codable, Equatable {
    let text: String
    let allowResearch: Bool
    let allowProfileContext: Bool
    let allowProfileMutation: Bool

    init(
        text: String,
        allowResearch: Bool = false,
        allowProfileContext: Bool = true,
        allowProfileMutation: Bool = false
    ) {
        self.text = text
        self.allowResearch = allowResearch
        self.allowProfileContext = allowProfileContext
        self.allowProfileMutation = allowProfileMutation
    }
}

struct BrainQueryResponse: Codable, Equatable {
    let status: String?
    let answer: String?
    let message: String?
    let usedProfileContext: Bool?
    let taskId: String?
}

struct ProfileReviewResponse: Codable, Equatable {
    let confirmedFacts: [[String: JSONValue]]?
    let proposedFacts: [[String: JSONValue]]?
    let sensitiveCandidates: [[String: JSONValue]]?
    let rejectedFacts: [[String: JSONValue]]?
    let profileSummary: String?
    let pendingActions: [String: JSONValue]?
}
