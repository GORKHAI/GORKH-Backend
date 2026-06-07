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

    func testAppIconAssetExistsAfterGeneration() {
        let testFile = URL(fileURLWithPath: #filePath)
        let appRoot = testFile.deletingLastPathComponent().deletingLastPathComponent()
        let iconSet = appRoot.appendingPathComponent("NearMind/Resources/Assets.xcassets/AppIcon.appiconset")

        XCTAssertTrue(FileManager.default.fileExists(atPath: iconSet.appendingPathComponent("Contents.json").path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: iconSet.appendingPathComponent("Icon-1024.png").path))
    }

    func testMicrophonePermissionStateMapping() {
        XCTAssertEqual(MicrophonePermission.from(.granted), .granted)
        XCTAssertEqual(MicrophonePermission.from(.denied), .denied)
        XCTAssertEqual(MicrophonePermission.from(.undetermined), .unknown)
    }

    func testAudioSessionRouteModelClassifiesCommonPorts() {
        XCTAssertEqual(AudioRouteInfo.kind(for: AVAudioSession.Port.builtInMic.rawValue), .builtInMic)
        XCTAssertEqual(AudioRouteInfo.kind(for: AVAudioSession.Port.builtInSpeaker.rawValue), .speaker)
        XCTAssertEqual(AudioRouteInfo.kind(for: AVAudioSession.Port.headphones.rawValue), .headphones)
        XCTAssertEqual(AudioRouteInfo.kind(for: AVAudioSession.Port.bluetoothHFP.rawValue), .bluetooth)
    }

    func testGenericRecentSessionTitleIsHumanized() {
        let summary = ChatBriefingSummary(
            openTaskCount: 0,
            relayRequestCount: 0,
            pendingApprovalCount: 0,
            recentSessionTitle: "Session"
        )

        XCTAssertEqual(summary.displayRecentSessionTitle, "Latest saved session")
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
            speechOutput: SpeechOutputManager(synthesizer: MockSpeechSynthesizer()),
            microphonePermissionProvider: MockMicrophonePermissionProvider(status: .granted),
            audioSessionManager: MockAudioSessionManager()
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
            speechOutput: SpeechOutputManager(synthesizer: MockSpeechSynthesizer()),
            microphonePermissionProvider: MockMicrophonePermissionProvider(status: .granted),
            audioSessionManager: MockAudioSessionManager()
        )

        viewModel.configure(environment: environment, appState: appState)

        XCTAssertFalse(viewModel.canStartVoiceSession)
        viewModel.hasConsent = true
        XCTAssertTrue(viewModel.canStartVoiceSession)
    }

    @MainActor
    func testVoiceChatLaunchIntentUsesGeneralConversationDefaults() {
        let environment = makeEnvironment(token: "test.jwt")
        let appState = AppState(environment: environment)
        let viewModel = LiveAssistViewModel(
            gatewayClient: MockGatewayVoiceClient(),
            audioStreamer: MockAudioStreamer(),
            speechOutput: SpeechOutputManager(synthesizer: MockSpeechSynthesizer()),
            microphonePermissionProvider: MockMicrophonePermissionProvider(status: .granted),
            audioSessionManager: MockAudioSessionManager()
        )

        viewModel.configure(environment: environment, appState: appState)
        viewModel.applyLaunchIntent(.voiceChat)

        XCTAssertEqual(viewModel.policy, .conversationAgent)
        XCTAssertEqual(viewModel.situationDescription, "Open conversation with NearMind.")
        XCTAssertEqual(viewModel.title, "Voice chat with NearMind")
        XCTAssertFalse(viewModel.isMicrophoneRunning)
    }

    @MainActor
    func testStopClearsActiveAudioState() async throws {
        let gateway = MockGatewayVoiceClient()
        let audio = MockAudioStreamer()
        let viewModel = LiveAssistViewModel(
            gatewayClient: gateway,
            audioStreamer: audio,
            speechOutput: SpeechOutputManager(synthesizer: MockSpeechSynthesizer()),
            microphonePermissionProvider: MockMicrophonePermissionProvider(status: .granted),
            audioSessionManager: MockAudioSessionManager()
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
            speechOutput: SpeechOutputManager(synthesizer: MockSpeechSynthesizer()),
            microphonePermissionProvider: MockMicrophonePermissionProvider(status: .granted),
            audioSessionManager: MockAudioSessionManager()
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
            speechOutput: speech,
            microphonePermissionProvider: MockMicrophonePermissionProvider(status: .granted),
            audioSessionManager: MockAudioSessionManager()
        )
        let environment = makeEnvironment(token: "test.jwt")
        viewModel.configure(environment: environment, appState: AppState(environment: environment))

        viewModel.simulateBargeIn()
        try await Task.sleep(nanoseconds: 150_000_000)

        XCTAssertTrue(gateway.didSendSpeechStarted)
        XCTAssertEqual(synth.stopCount, 1)
    }

    @MainActor
    func testFailedStartClearsAudioActiveState() async throws {
        let gateway = MockGatewayVoiceClient()
        let audio = MockAudioStreamer()
        audio.startError = AudioStreamingError.conversionFailed
        let viewModel = LiveAssistViewModel(
            gatewayClient: gateway,
            audioStreamer: audio,
            speechOutput: SpeechOutputManager(synthesizer: MockSpeechSynthesizer()),
            microphonePermissionProvider: MockMicrophonePermissionProvider(status: .granted),
            audioSessionManager: MockAudioSessionManager()
        )
        let environment = makeEnvironment(token: "test.jwt")
        let appState = AppState(environment: environment)
        viewModel.configure(environment: environment, appState: appState)
        viewModel.hasConsent = true

        viewModel.startVoiceSession()
        try await Task.sleep(nanoseconds: 150_000_000)

        XCTAssertTrue(audio.didStop)
        XCTAssertFalse(viewModel.isMicrophoneRunning)
        XCTAssertEqual(viewModel.status, AudioStreamingError.conversionFailed.localizedDescription)
    }

    @MainActor
    func testBackgroundEventClearsMicAndTTSState() async throws {
        let gateway = MockGatewayVoiceClient()
        let audio = MockAudioStreamer()
        let synth = MockSpeechSynthesizer()
        let speech = SpeechOutputManager(synthesizer: synth)
        speech.speak(text: "Speaking now", speechId: "speech-4", deliveryTarget: "local")
        let viewModel = LiveAssistViewModel(
            gatewayClient: gateway,
            audioStreamer: audio,
            speechOutput: speech,
            microphonePermissionProvider: MockMicrophonePermissionProvider(status: .granted),
            audioSessionManager: MockAudioSessionManager()
        )
        let environment = makeEnvironment(token: "test.jwt")
        viewModel.configure(environment: environment, appState: AppState(environment: environment))
        viewModel.hasConsent = true

        viewModel.startVoiceSession()
        try await Task.sleep(nanoseconds: 500_000_000)
        viewModel.stopForBackground()
        try await Task.sleep(nanoseconds: 500_000_000)

        XCTAssertTrue(audio.didStop)
        XCTAssertFalse(viewModel.isMicrophoneRunning)
        XCTAssertEqual(synth.stopCount, 1)
    }

    func testLocalTelemetryRecordsFirstEventsOnly() {
        var telemetry = VoiceSessionTelemetry()
        let base = Date(timeIntervalSince1970: 10)
        telemetry.recordMicStarted(at: base)
        telemetry.recordFirstASRFinal(at: base.addingTimeInterval(0.25))
        telemetry.recordFirstASRFinal(at: base.addingTimeInterval(3.0))
        telemetry.recordFirstCue(at: base.addingTimeInterval(0.5))
        telemetry.recordFirstTTSInstruction(at: base.addingTimeInterval(0.5))
        telemetry.recordLocalTTSStarted(at: base.addingTimeInterval(0.625))

        XCTAssertEqual(telemetry.rows(), [
            "Mic start -> first ASR final: 250 ms",
            "Mic start -> first cue: 500 ms",
            "TTS instruction -> local TTS start: 125 ms"
        ])
    }

    func testRealDeviceChecklistStateTransitions() {
        var checklist = RealDeviceSmokeChecklist()
        checklist.mark(.tokenStored, status: .passed, detail: "stored")

        let check = checklist.check(.tokenStored)
        XCTAssertEqual(check?.status, .passed)
        XCTAssertEqual(check?.detail, "stored")
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
    var startError: Error?
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
        if let startError {
            throw startError
        }
        isRunning = true
    }

    func stop() {
        didStop = true
        isRunning = false
    }
}

private struct MockMicrophonePermissionProvider: MicrophonePermissionProviding {
    let status: MicrophonePermissionStatus

    func currentStatus() -> MicrophonePermissionStatus {
        status
    }

    func request() async -> MicrophonePermissionStatus {
        status
    }
}

private final class MockAudioSessionManager: AudioSessionManaging {
    var currentRouteInfo = AudioRouteInfo(
        inputKind: .builtInMic,
        inputName: "Mock mic",
        outputKind: .speaker,
        outputName: "Mock speaker",
        hasInput: true
    )

    func configureForVoiceSession() throws {}
    func deactivate() {}

    func observeRouteChanges(_ handler: @escaping @MainActor (AudioRouteChange) -> Void) -> NSObjectProtocol {
        NSObject()
    }

    func removeRouteObserver(_ token: NSObjectProtocol) {}
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
