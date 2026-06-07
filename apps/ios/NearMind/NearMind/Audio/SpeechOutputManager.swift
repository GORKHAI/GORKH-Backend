import AVFoundation
import Foundation

protocol SpeechOutputSynthesizing: AnyObject {
    var isSpeaking: Bool { get }
    func speak(_ utterance: AVSpeechUtterance)
    @discardableResult func stopSpeaking(at boundary: AVSpeechBoundary) -> Bool
}

extension AVSpeechSynthesizer: SpeechOutputSynthesizing {}

@MainActor
final class SpeechOutputManager: ObservableObject {
    @Published var isMuted = false
    @Published var outputMode: VoiceOutputMode = .native
    @Published var voiceCharacter: NaturalVoiceCharacterID = .calmGuide
    @Published var naturalFallbackEnabled = true
    @Published private(set) var isSpeaking = false
    @Published private(set) var currentSpeechId: String?
    @Published private(set) var deliveryTarget = "local"
    @Published private(set) var status = "TTS idle"

    private let synthesizer: SpeechOutputSynthesizing
    private let naturalPlayer: NaturalVoicePlaying
    private var ttsClient: TTSClientProtocol?
    private let maxSpokenCharacters = 320

    init(
        synthesizer: SpeechOutputSynthesizing = AVSpeechSynthesizer(),
        naturalPlayer: NaturalVoicePlaying? = nil,
        ttsClient: TTSClientProtocol? = nil
    ) {
        self.synthesizer = synthesizer
        self.naturalPlayer = naturalPlayer ?? NaturalVoicePlayer()
        self.ttsClient = ttsClient
    }

    func configureNaturalVoice(
        mode: VoiceOutputMode,
        character: NaturalVoiceCharacterID,
        fallbackEnabled: Bool,
        ttsClient: TTSClientProtocol?
    ) {
        outputMode = mode
        voiceCharacter = character
        naturalFallbackEnabled = fallbackEnabled
        self.ttsClient = ttsClient
    }

    func handle(event: GatewayServerEvent) {
        switch event {
        case .gatewayClientTTSInstruction(let payload):
            handleTTSInstruction(payload)
        case .voiceCancelSpeech(let payload):
            cancel(speechId: payload["speechId"]?.stringValue)
        default:
            break
        }
    }

    @discardableResult
    func speak(text: String, speechId: String?, deliveryTarget: String?) -> Bool {
        let cleanText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanText.isEmpty else { return false }
        guard !isMuted else {
            status = "TTS muted"
            return false
        }
        guard cleanText.count <= maxSpokenCharacters else {
            status = "Skipped long TTS report"
            return false
        }

        let target = deliveryTarget ?? "local"
        guard target != "screen_only" else {
            status = "Skipped screen-only report"
            return false
        }

        currentSpeechId = speechId
        self.deliveryTarget = target
        if outputMode == .natural {
            speakNatural(text: cleanText, speechId: speechId, purpose: purpose(for: target))
        } else {
            speakNative(cleanText)
        }
        return true
    }

    func cancel(speechId: String? = nil) {
        guard speechId == nil || speechId == currentSpeechId || synthesizer.isSpeaking else {
            return
        }
        synthesizer.stopSpeaking(at: .immediate)
        naturalPlayer.stop()
        currentSpeechId = nil
        isSpeaking = false
        status = "TTS stopped"
    }

    private func handleTTSInstruction(_ payload: [String: JSONValue]) {
        let text = payload["text"]?.stringValue
            ?? payload["message"]?.stringValue
            ?? payload["instruction"]?.stringValue
            ?? ""
        let speechId = payload["speechId"]?.stringValue ?? payload["id"]?.stringValue
        let target = payload["deliveryTarget"]?.stringValue
            ?? payload["target"]?.stringValue
            ?? payload["delivery"]?.stringValue
        if let maxWords = payload["maxWords"]?.numberValue, wordCount(text) > Int(maxWords) {
            status = "Skipped long TTS report"
            return
        }
        speak(text: text, speechId: speechId, deliveryTarget: target)
    }

    private func speakNative(_ text: String, fallback: Bool = false) {
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = preferredNativeVoice()
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        synthesizer.speak(utterance)
        isSpeaking = true
        status = fallback ? "Fallback native" : "Native speaking"
    }

    private func speakNatural(text: String, speechId: String?, purpose: TTSPurpose) {
        guard let ttsClient else {
            fallbackOrFail(text: text, message: "Natural Voice unavailable")
            return
        }
        status = "Natural loading"
        isSpeaking = false
        let selectedCharacter = purpose == .whisperCue ? NaturalVoiceCharacterID.focusWhisper : voiceCharacter
        Task { @MainActor in
            do {
                let response = try await ttsClient.synthesize(
                    TTSRequest(
                        text: text,
                        speechId: speechId,
                        voiceCharacterId: selectedCharacter,
                        purpose: purpose
                    )
                )
                try naturalPlayer.play(audioData: response.audioData)
                isSpeaking = true
                status = "Natural playing"
            } catch {
                fallbackOrFail(text: text, message: error.localizedDescription)
            }
        }
    }

    private func fallbackOrFail(text: String, message: String) {
        if naturalFallbackEnabled {
            naturalPlayer.stop()
            speakNative(text, fallback: true)
        } else {
            isSpeaking = false
            status = "Natural failed: \(message)"
        }
    }

    private func purpose(for deliveryTarget: String) -> TTSPurpose {
        deliveryTarget == "earbud" || deliveryTarget == "whisper" ? .whisperCue : .assistantResponse
    }

    private func preferredNativeVoice() -> AVSpeechSynthesisVoice? {
        let candidates = AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.language.hasPrefix("en") }
        return candidates.first { $0.quality == .premium }
            ?? candidates.first { $0.quality == .enhanced }
            ?? AVSpeechSynthesisVoice(language: "en-US")
    }

    private func wordCount(_ text: String) -> Int {
        text.split(whereSeparator: \.isWhitespace).count
    }
}
