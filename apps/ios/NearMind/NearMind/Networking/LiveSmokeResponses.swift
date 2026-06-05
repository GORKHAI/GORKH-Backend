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
