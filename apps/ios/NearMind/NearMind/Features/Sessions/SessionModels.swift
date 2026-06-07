import Foundation

enum SessionRetentionStatus: String, Equatable {
    case saved
    case discarded
    case unknown

    var title: String {
        switch self {
        case .saved:
            return "Saved"
        case .discarded:
            return "Discarded"
        case .unknown:
            return "Session"
        }
    }
}

struct SessionListItem: Identifiable, Equatable {
    let id: String
    let title: String
    let date: Date?
    let preview: String
    let retentionStatus: SessionRetentionStatus
    let summary: String?
    let cues: [String]
    let commitments: [String]
    let followUps: [String]
    let transcriptSnippets: [String]
    let diagnostics: [String]

    static func from(syncItem: MobileSyncItem) -> SessionListItem? {
        guard syncItem.type.lowercased().contains("session")
            || syncItem.type.lowercased().contains("conversation")
            || syncItem.type.lowercased().contains("voice")
        else {
            return nil
        }

        let item = syncItem.item
        let id = item.string(for: "sessionId", "id", "voiceSessionId") ?? UUID().uuidString
        let title = item.string(for: "title", "name", "policy")
            ?? syncItem.type.replacingOccurrences(of: "_", with: " ").capitalized
        let summary = item.string(for: "summary", "brief", "description")
        let preview = item.string(for: "preview", "text", "message", "transcript")
            ?? summary
            ?? "No summary available yet."
        let retention = Self.retentionStatus(from: item)
        let date = item.date(for: "updatedAt", "createdAt", "timestamp", "endedAt")

        return SessionListItem(
            id: id,
            title: title,
            date: date,
            preview: preview,
            retentionStatus: retention,
            summary: summary,
            cues: item.strings(for: "cues", "keyCues", "voiceCues"),
            commitments: item.strings(for: "commitments"),
            followUps: item.strings(for: "followUps", "tasks"),
            transcriptSnippets: item.strings(for: "transcriptSnippets", "transcript", "snippets"),
            diagnostics: Self.diagnostics(from: item)
        )
    }

    private static func retentionStatus(from item: [String: JSONValue]) -> SessionRetentionStatus {
        let raw = item.string(for: "retentionPolicy", "status", "saveStatus")?.lowercased() ?? ""
        if raw.contains("discard") {
            return .discarded
        }
        if raw.contains("save") || raw.contains("complete") {
            return .saved
        }
        return .unknown
    }

    private static func diagnostics(from item: [String: JSONValue]) -> [String] {
        ["latencyMs", "durationMs", "eventCount", "status"].compactMap { key in
            guard let value = item[key]?.compactDescription else { return nil }
            return "\(key): \(value)"
        }
    }
}

struct SessionsContent: Equatable {
    var sessions: [SessionListItem] = []

    var isEmpty: Bool {
        sessions.isEmpty
    }

    static let empty = SessionsContent()
}

extension Dictionary where Key == String, Value == JSONValue {
    func string(for keys: String...) -> String? {
        for key in keys {
            if let value = self[key]?.stringValue, !value.isEmpty {
                return value
            }
        }
        return nil
    }

    func strings(for keys: String...) -> [String] {
        for key in keys {
            guard let value = self[key] else { continue }
            if let array = value.arrayValue {
                let strings = array.compactMap(\.stringValue).filter { !$0.isEmpty }
                if !strings.isEmpty {
                    return strings
                }
            }
            if let string = value.stringValue, !string.isEmpty {
                return [string]
            }
        }
        return []
    }

    func date(for keys: String...) -> Date? {
        let formatter = ISO8601DateFormatter()
        for key in keys {
            guard let string = self[key]?.stringValue else { continue }
            if let date = formatter.date(from: string) {
                return date
            }
        }
        return nil
    }
}

private extension JSONValue {
    var compactDescription: String? {
        if let stringValue {
            return stringValue
        }
        if let numberValue {
            return String(Int(numberValue))
        }
        if let boolValue {
            return boolValue ? "true" : "false"
        }
        return nil
    }
}
