import Foundation

enum VoiceOutputMode: String, CaseIterable, Codable, Equatable, Identifiable {
    case native
    case natural

    var id: String { rawValue }

    var displayTitle: String {
        switch self {
        case .native: return "Native Voice"
        case .natural: return "Natural Voice Beta"
        }
    }
}

enum NaturalVoiceCharacterID: String, CaseIterable, Codable, Equatable, Identifiable {
    case calmGuide = "calm_guide"
    case professional
    case warmSupport = "warm_support"
    case focusWhisper = "focus_whisper"
    case briefingVoice = "briefing_voice"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .calmGuide: return "Calm Guide"
        case .professional: return "Professional"
        case .warmSupport: return "Warm Support"
        case .focusWhisper: return "Focus Whisper"
        case .briefingVoice: return "Briefing Voice"
        }
    }

    var subtitle: String {
        switch self {
        case .calmGuide: return "Calm, neutral, clear"
        case .professional: return "Confident and business-like"
        case .warmSupport: return "Softer and reassuring"
        case .focusWhisper: return "Short, low-distraction cues"
        case .briefingVoice: return "Crisp summaries and briefs"
        }
    }
}

enum TTSPurpose: String, Codable, Equatable {
    case assistantResponse = "assistant_response"
    case whisperCue = "whisper_cue"
    case dailyBrief = "daily_brief"
    case stressSupport = "stress_support"
    case investorPrep = "investor_prep"
}

struct TTSRequest: Encodable, Equatable {
    let text: String
    let speechId: String?
    let voiceCharacterId: NaturalVoiceCharacterID
    let purpose: TTSPurpose
}

struct TTSAudioResponse: Equatable {
    let audioData: Data
    let contentType: String
    let provider: String?
    let voiceCharacter: String?
    let latencyMs: String?
}

protocol TTSClientProtocol {
    func synthesize(_ ttsRequest: TTSRequest) async throws -> TTSAudioResponse
}

final class TTSClient: TTSClientProtocol {
    private let config: AppConfig
    private let tokenStore: TokenStoreProtocol
    private let session: URLSession
    private let decoder = JSONDecoder()

    init(config: AppConfig, tokenStore: TokenStoreProtocol, session: URLSession = .shared) {
        self.config = config
        self.tokenStore = tokenStore
        self.session = session
    }

    func synthesize(_ ttsRequest: TTSRequest) async throws -> TTSAudioResponse {
        let request = try makeURLRequest(ttsRequest)
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw APIClientError.httpStatus(httpResponse.statusCode, decodeMobileError(from: data))
        }
        return TTSAudioResponse(
            audioData: data,
            contentType: httpResponse.value(forHTTPHeaderField: "Content-Type") ?? "audio/mpeg",
            provider: httpResponse.value(forHTTPHeaderField: "X-NearMind-TTS-Provider"),
            voiceCharacter: httpResponse.value(forHTTPHeaderField: "X-NearMind-Voice-Character"),
            latencyMs: httpResponse.value(forHTTPHeaderField: "X-NearMind-TTS-Latency-Ms")
        )
    }

    func makeURLRequest(_ ttsRequest: TTSRequest) throws -> URLRequest {
        var request = URLRequest(url: config.gatewayHTTPURL.appending(path: "tts/synthesize"))
        request.httpMethod = HTTPMethod.post.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("audio/mpeg", forHTTPHeaderField: "Accept")
        if let token = try tokenStore.readToken(), !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try JSONEncoder().encode(ttsRequest)
        return request
    }

    private func decodeMobileError(from data: Data) -> MobileError? {
        if let envelope = try? decoder.decode(TTSMobileErrorEnvelope.self, from: data) {
            return envelope.error
        }
        return try? decoder.decode(MobileError.self, from: data)
    }
}

private struct TTSMobileErrorEnvelope: Decodable {
    let error: MobileError
}
