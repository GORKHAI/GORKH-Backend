import Foundation

enum MobileProtocol {
    static let protocolVersion = 1
}

enum AssistPolicy: String, CaseIterable, Codable, Identifiable {
    case conversationAgent = "conversation_agent"
    case whisperCopilot = "whisper_copilot"

    var id: String { rawValue }
}

enum TextInputKind: String, Codable {
    case text
    case pcm16
}

enum OutputKind: String, Codable {
    case both
}

enum RetentionPolicy: String, Codable {
    case askOnStop = "ask_on_stop"
    case discardOnStop = "discard_on_stop"
}

enum ClientEventType: String, Codable {
    case start
    case userText = "user_text"
    case transcript
    case speechStarted = "speech_started"
    case speechEnded = "speech_ended"
    case stop
}

struct JSONValue: Codable, Hashable {
    let value: AnyHashable?

    init(_ value: AnyHashable?) {
        self.value = value
    }

    var stringValue: String? {
        value?.base as? String
    }

    var boolValue: Bool? {
        value?.base as? Bool
    }

    var dictionaryValue: [String: JSONValue]? {
        value?.base as? [String: JSONValue]
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            value = nil
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let array = try? container.decode([JSONValue].self) {
            value = AnyHashable(array)
        } else if let dictionary = try? container.decode([String: JSONValue].self) {
            value = AnyHashable(dictionary)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        guard let value else {
            try container.encodeNil()
            return
        }

        switch value.base {
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [JSONValue]:
            try container.encode(array)
        case let dictionary as [String: JSONValue]:
            try container.encode(dictionary)
        default:
            try container.encode(String(describing: value.base))
        }
    }
}
