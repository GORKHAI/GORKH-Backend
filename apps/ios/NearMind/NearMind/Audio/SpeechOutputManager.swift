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
    @Published private(set) var isSpeaking = false
    @Published private(set) var currentSpeechId: String?
    @Published private(set) var deliveryTarget = "local"
    @Published private(set) var status = "TTS idle"

    private let synthesizer: SpeechOutputSynthesizing
    private let maxSpokenCharacters = 320

    init(synthesizer: SpeechOutputSynthesizing = AVSpeechSynthesizer()) {
        self.synthesizer = synthesizer
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

    func speak(text: String, speechId: String?, deliveryTarget: String?) {
        let cleanText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanText.isEmpty else { return }
        guard !isMuted else {
            status = "TTS muted"
            return
        }
        guard cleanText.count <= maxSpokenCharacters else {
            status = "Skipped long TTS report"
            return
        }

        let target = deliveryTarget ?? "local"
        guard target != "screen_only" else {
            status = "Skipped screen-only report"
            return
        }

        currentSpeechId = speechId
        self.deliveryTarget = target
        let utterance = AVSpeechUtterance(string: cleanText)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        synthesizer.speak(utterance)
        isSpeaking = true
        status = "Speaking"
    }

    func cancel(speechId: String? = nil) {
        guard speechId == nil || speechId == currentSpeechId || synthesizer.isSpeaking else {
            return
        }
        synthesizer.stopSpeaking(at: .immediate)
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
        speak(text: text, speechId: speechId, deliveryTarget: target)
    }
}
