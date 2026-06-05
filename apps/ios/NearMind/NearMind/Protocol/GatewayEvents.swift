import Foundation

enum GatewayServerEvent: Equatable {
    case gatewayAck([String: JSONValue])
    case gatewayState([String: JSONValue])
    case gatewayProviderError([String: JSONValue])
    case gatewayASRPartial([String: JSONValue])
    case gatewayASRFinal([String: JSONValue])
    case gatewayClientTTSInstruction([String: JSONValue])
    case gatewayMetrics([String: JSONValue])
    case gatewayWarning([String: JSONValue])
    case gatewayError([String: JSONValue])
    case voiceAck([String: JSONValue])
    case voiceState([String: JSONValue])
    case voiceSegment([String: JSONValue])
    case voiceTriggers([String: JSONValue])
    case voiceCue([String: JSONValue])
    case voiceAssistantText([String: JSONValue])
    case voiceSpeakRequest([String: JSONValue])
    case voiceCancelSpeech([String: JSONValue])
    case voiceSubagentStarted([String: JSONValue])
    case voiceSubagentProgress([String: JSONValue])
    case voiceSubagentReport([String: JSONValue])
    case voiceSubagentFailed([String: JSONValue])
    case summary([String: JSONValue])
    case error(MobileError)
    case unknown(type: String?, payload: [String: JSONValue])

    var displayName: String {
        switch self {
        case .gatewayAck: return "gateway_ack"
        case .gatewayState: return "gateway_state"
        case .gatewayProviderError: return "gateway_provider_error"
        case .gatewayASRPartial: return "gateway_asr_partial"
        case .gatewayASRFinal: return "gateway_asr_final"
        case .gatewayClientTTSInstruction: return "gateway_client_tts_instruction"
        case .gatewayMetrics: return "gateway_metrics"
        case .gatewayWarning: return "gateway_warning"
        case .gatewayError: return "gateway_error"
        case .voiceAck: return "voice_ack"
        case .voiceState: return "voice_state"
        case .voiceSegment: return "voice_segment"
        case .voiceTriggers: return "voice_triggers"
        case .voiceCue: return "voice_cue"
        case .voiceAssistantText: return "voice_assistant_text"
        case .voiceSpeakRequest: return "voice_speak_request"
        case .voiceCancelSpeech: return "voice_cancel_speech"
        case .voiceSubagentStarted: return "voice_subagent_started"
        case .voiceSubagentProgress: return "voice_subagent_progress"
        case .voiceSubagentReport: return "voice_subagent_report"
        case .voiceSubagentFailed: return "voice_subagent_failed"
        case .summary: return "summary"
        case .error(let error): return "error:\(error.code)"
        case .unknown(let type, _): return type.map { "unknown:\($0)" } ?? "unknown"
        }
    }
}

extension GatewayServerEvent: Decodable {
    private enum CodingKeys: String, CodingKey {
        case type
        case event
        case code
        case message
        case retryable
        case details
        case error
    }

    init(from decoder: Decoder) throws {
        let payload = try [String: JSONValue](from: decoder)
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let eventType = (try? container.decode(String.self, forKey: .type))
            ?? (try? container.decode(String.self, forKey: .event))

        switch eventType {
        case "gateway_ack": self = .gatewayAck(payload)
        case "gateway_state": self = .gatewayState(payload)
        case "gateway_provider_error": self = .gatewayProviderError(payload)
        case "gateway_asr_partial": self = .gatewayASRPartial(payload)
        case "gateway_asr_final": self = .gatewayASRFinal(payload)
        case "gateway_client_tts_instruction": self = .gatewayClientTTSInstruction(payload)
        case "gateway_metrics": self = .gatewayMetrics(payload)
        case "gateway_warning": self = .gatewayWarning(payload)
        case "gateway_error": self = .gatewayError(payload)
        case "voice_ack": self = .voiceAck(payload)
        case "voice_state": self = .voiceState(payload)
        case "voice_segment": self = .voiceSegment(payload)
        case "voice_triggers": self = .voiceTriggers(payload)
        case "voice_cue": self = .voiceCue(payload)
        case "voice_assistant_text": self = .voiceAssistantText(payload)
        case "voice_speak_request": self = .voiceSpeakRequest(payload)
        case "voice_cancel_speech": self = .voiceCancelSpeech(payload)
        case "voice_subagent_started": self = .voiceSubagentStarted(payload)
        case "voice_subagent_progress": self = .voiceSubagentProgress(payload)
        case "voice_subagent_report": self = .voiceSubagentReport(payload)
        case "voice_subagent_failed": self = .voiceSubagentFailed(payload)
        case "summary": self = .summary(payload)
        case "error":
            if let nestedError = try? container.decode(MobileError.self, forKey: .error) {
                self = .error(nestedError)
            } else {
                self = .error(try MobileError(from: decoder))
            }
        default:
            self = .unknown(type: eventType, payload: payload)
        }
    }
}
