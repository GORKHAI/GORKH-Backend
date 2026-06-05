import AVFoundation
import XCTest
@testable import NearMind

final class AudioVoiceSessionTests: XCTestCase {
    func testMicrophoneCannotStartBeforeConsent() throws {
        let streamer = PCM16AudioStreamer()
        XCTAssertThrowsError(
            try streamer.start(
                consentGranted: false,
                sessionActive: true,
                onLevel: { _ in },
                onFrame: { _ in },
                onError: { _ in }
            )
        ) { error in
            XCTAssertEqual(error as? AudioStreamingError, .consentRequired)
        }
    }

    func testMicrophoneCannotStartBeforeSessionActive() throws {
        let streamer = PCM16AudioStreamer()
        XCTAssertThrowsError(
            try streamer.start(
                consentGranted: true,
                sessionActive: false,
                onLevel: { _ in },
                onFrame: { _ in },
                onError: { _ in }
            )
        ) { error in
            XCTAssertEqual(error as? AudioStreamingError, .sessionNotActive)
        }
    }

    @MainActor
    func testTTSManagerHandlesSpeakRequest() {
        let synth = MockSpeechSynthesizer()
        let manager = SpeechOutputManager(synthesizer: synth)

        manager.handle(event: .gatewayClientTTSInstruction([
            "text": JSONValue("Ask about prepayment penalties."),
            "speechId": JSONValue("speech-1"),
            "deliveryTarget": JSONValue("local")
        ]))

        XCTAssertEqual(synth.spokenStrings, ["Ask about prepayment penalties."])
        XCTAssertEqual(manager.currentSpeechId, "speech-1")
        XCTAssertEqual(manager.deliveryTarget, "local")
    }

    @MainActor
    func testTTSManagerHandlesCancelSpeech() {
        let synth = MockSpeechSynthesizer()
        let manager = SpeechOutputManager(synthesizer: synth)
        manager.speak(text: "Short cue", speechId: "speech-2", deliveryTarget: "local")

        manager.handle(event: .voiceCancelSpeech(["speechId": JSONValue("speech-2")]))

        XCTAssertEqual(synth.stopCount, 1)
        XCTAssertNil(manager.currentSpeechId)
    }

    @MainActor
    func testScreenOnlyReportIsNotSpoken() {
        let synth = MockSpeechSynthesizer()
        let manager = SpeechOutputManager(synthesizer: synth)

        manager.speak(text: "Detailed screen-only report", speechId: "report-1", deliveryTarget: "screen_only")

        XCTAssertTrue(synth.spokenStrings.isEmpty)
        XCTAssertEqual(manager.status, "Skipped screen-only report")
    }

    @MainActor
    func testLongReportIsNotSpoken() {
        let synth = MockSpeechSynthesizer()
        let manager = SpeechOutputManager(synthesizer: synth)

        manager.speak(text: String(repeating: "a", count: 400), speechId: "long-1", deliveryTarget: "local")

        XCTAssertTrue(synth.spokenStrings.isEmpty)
        XCTAssertEqual(manager.status, "Skipped long TTS report")
    }

    @MainActor
    func testStartVoiceSessionDisabledWithoutToken() {
        let environment = makeEnvironment(token: nil)
        let appState = AppState(environment: environment)
        let viewModel = LiveAssistViewModel(
            gatewayClient: MockGatewayVoiceClient(),
            audioStreamer: MockAudioStreamer(),
            speechOutput: SpeechOutputManager(synthesizer: MockSpeechSynthesizer())
        )

        viewModel.configure(environment: environment, appState: appState)
        viewModel.hasConsent = true

        XCTAssertFalse(viewModel.canStartVoiceSession)
    }

    @MainActor
    func testStartVoiceSessionDisabledWithoutConsent() {
        let environment = makeEnvironment(token: "test.jwt")
        let appState = AppState(environment: environment)
        let viewModel = LiveAssistViewModel(
            gatewayClient: MockGatewayVoiceClient(),
            audioStreamer: MockAudioStreamer(),
            speechOutput: SpeechOutputManager(synthesizer: MockSpeechSynthesizer())
        )

        viewModel.configure(environment: environment, appState: appState)

        XCTAssertFalse(viewModel.canStartVoiceSession)
        viewModel.hasConsent = true
        XCTAssertTrue(viewModel.canStartVoiceSession)
    }

    @MainActor
    func testStopClearsActiveAudioState() async throws {
        let gateway = MockGatewayVoiceClient()
        let audio = MockAudioStreamer()
        let viewModel = LiveAssistViewModel(
            gatewayClient: gateway,
            audioStreamer: audio,
            speechOutput: SpeechOutputManager(synthesizer: MockSpeechSynthesizer())
        )
        let environment = makeEnvironment(token: "test.jwt")
        viewModel.configure(environment: environment, appState: AppState(environment: environment))

        viewModel.stopWithoutSaving()
        try await Task.sleep(nanoseconds: 100_000_000)

        XCTAssertTrue(audio.didStop)
        XCTAssertTrue(gateway.didSendStop)
        XCTAssertFalse(viewModel.isMicrophoneRunning)
    }

    @MainActor
    func testDisconnectClearsActiveAudioState() {
        let gateway = MockGatewayVoiceClient()
        let audio = MockAudioStreamer()
        let viewModel = LiveAssistViewModel(
            gatewayClient: gateway,
            audioStreamer: audio,
            speechOutput: SpeechOutputManager(synthesizer: MockSpeechSynthesizer())
        )
        let environment = makeEnvironment(token: "test.jwt")
        viewModel.configure(environment: environment, appState: AppState(environment: environment))

        viewModel.disconnect()

        XCTAssertTrue(audio.didStop)
        XCTAssertTrue(gateway.didDisconnect)
        XCTAssertFalse(viewModel.isMicrophoneRunning)
    }

    @MainActor
    func testBargeInSendsSpeechStartedAndStopsTTS() async throws {
        let gateway = MockGatewayVoiceClient()
        let synth = MockSpeechSynthesizer()
        let speech = SpeechOutputManager(synthesizer: synth)
        speech.speak(text: "Speaking now", speechId: "speech-3", deliveryTarget: "local")
        let viewModel = LiveAssistViewModel(
            gatewayClient: gateway,
            audioStreamer: MockAudioStreamer(),
            speechOutput: speech
        )
        let environment = makeEnvironment(token: "test.jwt")
        viewModel.configure(environment: environment, appState: AppState(environment: environment))

        viewModel.simulateBargeIn()
        try await Task.sleep(nanoseconds: 150_000_000)

        XCTAssertTrue(gateway.didSendSpeechStarted)
        XCTAssertEqual(synth.stopCount, 1)
    }

    private func makeEnvironment(token: String?) -> AppEnvironment {
        let store = VoiceTestTokenStore(token: token)
        return AppEnvironment(
            config: .production,
            tokenStore: store,
            apiClient: APIClient(config: .production, tokenStore: store)
        )
    }
}

private final class MockSpeechSynthesizer: SpeechOutputSynthesizing {
    private(set) var spokenStrings: [String] = []
    private(set) var stopCount = 0
    var isSpeaking = false

    func speak(_ utterance: AVSpeechUtterance) {
        spokenStrings.append(utterance.speechString)
        isSpeaking = true
    }

    func stopSpeaking(at boundary: AVSpeechBoundary) -> Bool {
        stopCount += 1
        isSpeaking = false
        return true
    }
}

@MainActor
private final class MockGatewayVoiceClient: GatewayVoiceClientProtocol {
    var isConnected = true
    var sessionActive = true
    var canSendAudio = true
    var lastSessionId: String? = "session-1"
    private(set) var didSendStop = false
    private(set) var didDisconnect = false
    private(set) var didSendSpeechStarted = false

    func connect(timeout seconds: TimeInterval, onEvent: @escaping GatewayEventHandler) async throws {
        isConnected = true
    }

    func sendStart(_ payload: StartSessionPayload) async throws {}

    func sendStartAndWaitForAck(_ payload: StartSessionPayload, timeout seconds: TimeInterval) async throws -> GatewayServerEvent {
        sessionActive = true
        return .gatewayAck(["sessionId": JSONValue("session-1")])
    }

    func sendUserText(_ text: String) async throws {}
    func sendTranscript(_ text: String) async throws {}

    func sendSpeechStarted() async throws {
        didSendSpeechStarted = true
    }

    func sendSpeechEnded() async throws {}

    func sendStop(save: Bool) async throws {
        didSendStop = true
        sessionActive = false
    }

    func sendAudioFrame(_ data: Data) async throws {}

    func disconnect() {
        didDisconnect = true
        isConnected = false
        sessionActive = false
    }
}

private final class MockAudioStreamer: PCM16AudioStreaming {
    var isRunning = false
    private(set) var didStop = false

    func start(
        consentGranted: Bool,
        sessionActive: Bool,
        onLevel: @escaping @Sendable (Double) -> Void,
        onFrame: @escaping @Sendable (Data) -> Void,
        onError: @escaping @Sendable (Error) -> Void
    ) throws {
        guard consentGranted else { throw AudioStreamingError.consentRequired }
        guard sessionActive else { throw AudioStreamingError.sessionNotActive }
        isRunning = true
    }

    func stop() {
        didStop = true
        isRunning = false
    }
}

private final class VoiceTestTokenStore: TokenStoreProtocol {
    private var token: String?

    init(token: String?) {
        self.token = token
    }

    func saveToken(_ token: String) throws {
        self.token = token
    }

    func readToken() throws -> String? {
        token
    }

    func clearToken() throws {
        token = nil
    }
}
