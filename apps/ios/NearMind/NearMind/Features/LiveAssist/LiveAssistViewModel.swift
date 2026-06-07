import Foundation

enum VoiceSessionError: Error, LocalizedError, Equatable {
    case missingToken
    case missingConsent
    case microphoneDenied
    case startAckMissing(String)

    var errorDescription: String? {
        switch self {
        case .missingToken:
            return "Sign in or add a test JWT in You → Developer first."
        case .missingConsent:
            return "Check consent before starting a voice session."
        case .microphoneDenied:
            return "Microphone permission is required for a voice session."
        case .startAckMissing(let eventName):
            return "Expected gateway_ack before microphone start, received \(eventName)."
        }
    }
}

@MainActor
final class LiveAssistViewModel: ObservableObject {
    @Published var policy: AssistPolicy = .conversationAgent
    @Published var situationDescription = "Bank loan meeting preparation."
    @Published var title = "NearMind voice session"
    @Published var hasConsent = false
    @Published var typedUserText = ""
    @Published var typedTranscript = ""
    @Published var ttsMuted = false {
        didSet {
            speechOutput.isMuted = ttsMuted
            updateTTSState()
        }
    }

    @Published private(set) var status = "Disconnected"
    @Published private(set) var isConnected = false
    @Published private(set) var isSessionActive = false
    @Published private(set) var isMicrophoneRunning = false
    @Published private(set) var microphonePermissionStatus: MicrophonePermissionStatus
    @Published private(set) var micLevel = 0.0
    @Published private(set) var audioRouteText: String
    @Published private(set) var asrLog: [String] = []
    @Published private(set) var assistantLog: [String] = []
    @Published private(set) var cueLog: [String] = []
    @Published private(set) var subagentLog: [String] = []
    @Published private(set) var ttsStatus = "TTS idle"
    @Published private(set) var ttsDeliveryTarget = "local"
    @Published private(set) var hasStoredToken = false
    @Published private(set) var isBusy = false
    @Published private(set) var lifecycleWarning: String?
    @Published private(set) var realDeviceChecks: [RealDeviceSmokeCheck]
    @Published private(set) var localLatencyRows: [String] = []
    @Published private(set) var backendLatencyRows: [String] = []

    private var client: GatewayVoiceClientProtocol?
    private var apiClient: APIClient?
    private let audioStreamer: PCM16AudioStreaming
    private let audioSessionManager: AudioSessionManaging
    private let microphonePermissionProvider: MicrophonePermissionProviding
    private let speechOutput: SpeechOutputManager
    private let injectedClient: GatewayVoiceClientProtocol?
    private weak var appState: AppState?
    private var hasReportedAudioSendError = false
    private var routeObserver: NSObjectProtocol?
    private var realDeviceChecklist = RealDeviceSmokeChecklist()
    private var telemetry = VoiceSessionTelemetry()

    var canStartVoiceSession: Bool {
        hasStoredToken && hasConsent && !isBusy
    }

    var lastSessionId: String? {
        client?.lastSessionId
    }

    init(
        gatewayClient: GatewayVoiceClientProtocol? = nil,
        audioStreamer: PCM16AudioStreaming? = nil,
        speechOutput: SpeechOutputManager? = nil,
        microphonePermissionProvider: MicrophonePermissionProviding = SystemMicrophonePermissionProvider(),
        audioSessionManager: AudioSessionManaging = AudioSessionManager()
    ) {
        self.injectedClient = gatewayClient
        self.audioSessionManager = audioSessionManager
        self.audioStreamer = audioStreamer ?? PCM16AudioStreamer(audioSessionManager: audioSessionManager)
        self.speechOutput = speechOutput ?? SpeechOutputManager()
        self.microphonePermissionProvider = microphonePermissionProvider
        self.microphonePermissionStatus = microphonePermissionProvider.currentStatus()
        self.audioRouteText = audioSessionManager.currentRouteInfo.summary
        self.realDeviceChecks = realDeviceChecklist.checks
    }

    deinit {
        if let routeObserver {
            audioSessionManager.removeRouteObserver(routeObserver)
        }
    }

    func configure(environment: AppEnvironment, appState: AppState) {
        guard client == nil else {
            refreshTokenState()
            return
        }
        self.appState = appState
        self.apiClient = environment.apiClient
        self.client = injectedClient ?? GatewayWebSocketClient(
            config: environment.config,
            tokenStore: environment.tokenStore
        )
        policy = appState.defaultAssistPolicy
        ttsMuted = appState.ttsMutedPreference
        observeAudioRouteChanges()
        refreshTokenState()
    }

    func refreshTokenState() {
        appState?.refreshAuthStatus()
        hasStoredToken = appState?.tokenStatus == .stored
        markSmoke(
            .tokenStored,
            status: hasStoredToken ? .passed : .failed,
            detail: hasStoredToken ? "JWT is stored in Keychain." : "Add a test JWT in You → Developer."
        )
    }

    func connect() {
        run {
            try await self.connectGatewayClient()
        }
    }

    func startVoiceSession() {
        run {
            self.refreshTokenState()
            guard self.hasStoredToken else { throw VoiceSessionError.missingToken }
            guard self.hasConsent else { throw VoiceSessionError.missingConsent }

            self.telemetry.reset()
            self.updateLocalLatencyRows()
            self.backendLatencyRows = []

            self.microphonePermissionStatus = await self.microphonePermissionProvider.request()
            guard self.microphonePermissionStatus == .granted else {
                self.markSmoke(.microphonePermissionGranted, status: .failed, detail: "Permission denied or unavailable.")
                throw VoiceSessionError.microphoneDenied
            }
            self.markSmoke(.microphonePermissionGranted, status: .passed, detail: "Permission granted.")

            if self.client?.isConnected != true {
                try await self.connectGatewayClient()
            }

            let payload = StartSessionPayload.pcm16Voice(
                policy: self.policy,
                situationDescription: self.situationDescription,
                title: self.title,
                consentGranted: self.hasConsent
            )
            self.status = "Starting voice session"
            let event = try await self.client?.sendStartAndWaitForAck(payload, timeout: 12)
            guard let event, case .gatewayAck = event else {
                throw VoiceSessionError.startAckMissing(event?.displayName ?? "none")
            }

            self.isSessionActive = self.client?.sessionActive == true
            do {
                try self.startMicrophoneAfterAck()
            } catch {
                self.stopLocalAudio(reason: "Failed to start microphone")
                throw error
            }
            if self.policy == .conversationAgent {
                self.markSmoke(.conversationStarted, status: .passed, detail: self.lastSessionId ?? "gateway_ack")
            } else {
                self.markSmoke(.whisperStarted, status: .passed, detail: self.lastSessionId ?? "gateway_ack")
            }
            self.status = "Voice session active"
            self.appState?.appendLocal(message: "Started PCM16 voice session")
        }
    }

    func stopWithoutSaving() {
        stop(save: false)
    }

    func stopAndSave() {
        stop(save: true)
    }

    func disconnect() {
        stopLocalAudio(reason: "Gateway disconnected")
        client?.disconnect()
        isConnected = false
        isSessionActive = false
        status = "Disconnected"
        appState?.appendLocal(message: "Gateway disconnected")
    }

    func simulateBargeIn() {
        speechOutput.cancel()
        updateTTSState()
        markSmoke(.bargeInTested, status: .passed, detail: "Sent speech_started and stopped local TTS.")
        send {
            try await self.client?.sendSpeechStarted()
            self.appState?.appendLocal(message: "Sent speech_started for barge-in")
            try? await Task.sleep(nanoseconds: 650_000_000)
            try await self.client?.sendSpeechEnded()
            self.appState?.appendLocal(message: "Sent speech_ended after barge-in")
        }
    }

    func fetchSessionState() {
        run {
            guard let sessionId = self.lastSessionId else {
                self.status = "No sessionId yet."
                return
            }
            let response = try await self.apiClient?.getMobileSessionState(sessionID: sessionId)
            self.appState?.appendRaw(title: "GET /mobile/sessions/:id/state", rawJSON: response?.rawJSON ?? "{}")
            self.markSmoke(.sessionStateFetched, status: .passed, detail: sessionId)
            self.status = "Fetched session state"
        }
    }

    func fetchLatencySummary() {
        run {
            guard let sessionId = self.lastSessionId else {
                self.status = "No sessionId yet."
                return
            }
            let response = try await self.apiClient?.getSessionLatencySummary(sessionID: sessionId)
            self.appState?.appendRaw(title: "GET /sessions/:id/latency-summary", rawJSON: response?.rawJSON ?? "{}")
            if let response {
                self.backendLatencyRows = self.formatBackendLatency(response.decoded?.latencySummary ?? response.raw)
            }
            self.markSmoke(.latencySummaryFetched, status: .passed, detail: sessionId)
            self.status = "Fetched latency summary"
        }
    }

    func stopForBackground() {
        guard isMicrophoneRunning || isSessionActive else { return }
        stopLocalAudio(reason: "App entered background; microphone stopped for v0.3.")
        lifecycleWarning = "App entered background; microphone stopped for v0.3."
        send {
            try await self.client?.sendStop(save: false)
            self.isSessionActive = false
            self.appState?.appendLocal(message: "Background stop sent save=false")
        }
    }

    func endViewSession() {
        stopLocalAudio(reason: "Live Assist closed")
        client?.disconnect()
        isConnected = false
        isSessionActive = false
    }

    func startTextSession() {
        guard hasConsent else {
            status = "Consent is required before starting."
            appState?.appendLocal(message: status)
            return
        }
        let payload = StartSessionPayload(
            policy: policy,
            situationDescription: situationDescription,
            title: title,
            consentGranted: hasConsent
        )
        send {
            try await self.client?.sendStart(payload)
            self.appState?.appendLocal(message: "Sent typed start")
        }
    }

    func sendTypedUserText() {
        let text = typedUserText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        send {
            try await self.client?.sendUserText(text)
            self.typedUserText = ""
            self.appState?.appendLocal(message: "Sent user_text")
        }
    }

    func sendTypedTranscript() {
        let text = typedTranscript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        send {
            try await self.client?.sendTranscript(text)
            self.typedTranscript = ""
            self.appState?.appendLocal(message: "Sent transcript")
        }
    }

    private func stop(save: Bool) {
        stopLocalAudio(reason: save ? "Stopping and saving" : "Stopping and discarding")
        send {
            try await self.client?.sendStop(save: save)
            self.isSessionActive = false
            self.status = save ? "Stopped save=true" : "Stopped save=false"
            if !save {
                self.markSmoke(.stopDiscarded, status: .passed, detail: "Sent stop save=false.")
            }
            self.appState?.appendLocal(message: save ? "Sent stop save=true" : "Sent stop save=false")
        }
    }

    private func connectGatewayClient() async throws {
        guard let client else { return }
        if client.isConnected {
            isConnected = true
            status = "Connected"
            return
        }
        status = "Connecting"
        try await client.connect(timeout: 10) { [weak self] event, rawJSON in
            Task { @MainActor in
                self?.handleGatewayEvent(event, rawJSON: rawJSON)
            }
        }
        isConnected = true
        status = "Connected"
        markSmoke(.gatewayConnected, status: .passed, detail: "Gateway WebSocket connected.")
        appState?.appendLocal(message: "Gateway connected")
    }

    private func startMicrophoneAfterAck() throws {
        guard let client else { return }
        hasReportedAudioSendError = false
        try audioStreamer.start(
            consentGranted: hasConsent,
            sessionActive: client.canSendAudio,
            onLevel: { [weak self] level in
                Task { @MainActor in
                    self?.micLevel = level
                }
            },
            onFrame: { [weak self] frame in
                Task { @MainActor in
                    await self?.sendAudioFrame(frame)
                }
            },
            onError: { [weak self] error in
                Task { @MainActor in
                    self?.handleAudioError(error)
                }
            }
        )
        isMicrophoneRunning = true
        micLevel = 0
        audioRouteText = audioSessionManager.currentRouteInfo.summary
        telemetry.recordMicStarted()
        updateLocalLatencyRows()
    }

    private func sendAudioFrame(_ frame: Data) async {
        do {
            try await client?.sendAudioFrame(frame)
        } catch {
            guard !hasReportedAudioSendError else { return }
            hasReportedAudioSendError = true
            handleAudioError(error)
        }
    }

    private func stopLocalAudio(reason: String) {
        audioStreamer.stop()
        isMicrophoneRunning = false
        micLevel = 0
        speechOutput.cancel()
        updateTTSState()
        markSmoke(.micStopped, status: .passed, detail: reason)
        markSmoke(.ttsStopped, status: .passed, detail: "Local TTS stopped.")
        status = reason
    }

    private func handleAudioError(_ error: Error) {
        audioStreamer.stop()
        isMicrophoneRunning = false
        status = error.localizedDescription
        appState?.appendLocal(message: "Audio stopped: \(error.localizedDescription)")
    }

    private func handleGatewayEvent(_ event: GatewayServerEvent, rawJSON: String) {
        appState?.append(event: event, rawJSON: rawJSON)
        speechOutput.handle(event: event)
        switch event {
        case .gatewayASRPartial(let payload):
            append(payloadText(payload), to: \.asrLog, prefix: "partial")
        case .gatewayASRFinal(let payload), .voiceSegment(let payload):
            append(payloadText(payload), to: \.asrLog, prefix: "final")
            telemetry.recordFirstASRFinal()
            updateLocalLatencyRows()
            markSmoke(.asrFinalReceived, status: .passed, detail: payloadText(payload))
        case .voiceAssistantText(let payload), .voiceSpeakRequest(let payload):
            append(payloadText(payload), to: \.assistantLog, prefix: "assistant")
            markSmoke(.assistantTextReceived, status: .passed, detail: payloadText(payload))
        case .gatewayClientTTSInstruction(let payload):
            telemetry.recordFirstTTSInstruction()
            if speechOutput.status == "Speaking" {
                telemetry.recordLocalTTSStarted()
                markSmoke(.ttsSpoken, status: .passed, detail: payloadText(payload))
            }
            updateLocalLatencyRows()
        case .voiceCue(let payload):
            let text = payloadText(payload)
            append(text, to: \.cueLog, prefix: "cue")
            telemetry.recordFirstCue()
            if speechOutput.speak(text: text, speechId: payload["speechId"]?.stringValue, deliveryTarget: "local") {
                telemetry.recordLocalTTSStarted()
                markSmoke(.ttsSpoken, status: .passed, detail: text)
            }
            updateLocalLatencyRows()
            markSmoke(.cueReceived, status: .passed, detail: text)
        case .voiceSubagentReport(let payload):
            append(payloadText(payload), to: \.subagentLog, prefix: payload["deliveryTarget"]?.stringValue ?? "report")
        case .voiceCancelSpeech:
            break
        case .gatewayError(let payload):
            if let code = payload["code"]?.stringValue {
                handleAuthCode(code)
            }
        case .error(let error):
            handleAuthCode(error.code)
        default:
            break
        }
        isSessionActive = client?.sessionActive == true
        updateTTSState()
    }

    func markLogPrivacyVerified() {
        markSmoke(.noTokenInLogs, status: .passed, detail: "Manual debug log check passed.")
        markSmoke(.noRawAudioInLogs, status: .passed, detail: "Manual debug log check passed.")
    }

    private func payloadText(_ payload: [String: JSONValue]) -> String {
        payload["text"]?.stringValue
            ?? payload["message"]?.stringValue
            ?? payload["transcript"]?.stringValue
            ?? payload["cue"]?.stringValue
            ?? payload["summary"]?.stringValue
            ?? payload["report"]?.stringValue
            ?? ""
    }

    private func append(_ text: String, to keyPath: ReferenceWritableKeyPath<LiveAssistViewModel, [String]>, prefix: String) {
        let value = text.isEmpty ? prefix : "\(prefix): \(text)"
        self[keyPath: keyPath].insert(value, at: 0)
        self[keyPath: keyPath] = Array(self[keyPath: keyPath].prefix(8))
    }

    private func updateTTSState() {
        ttsStatus = speechOutput.status
        ttsDeliveryTarget = speechOutput.deliveryTarget
    }

    private func updateLocalLatencyRows() {
        localLatencyRows = telemetry.rows()
    }

    private func observeAudioRouteChanges() {
        guard routeObserver == nil else { return }
        audioRouteText = audioSessionManager.currentRouteInfo.summary
        routeObserver = audioSessionManager.observeRouteChanges { [weak self] change in
            self?.handleAudioRouteChange(change)
        }
    }

    private func handleAudioRouteChange(_ change: AudioRouteChange) {
        audioRouteText = change.route.summary
        appState?.appendLocal(message: "Audio route changed: \(change.reason.rawValue) \(change.route.summary)")
        guard isMicrophoneRunning, !change.route.hasInput else { return }
        handleAudioError(AudioSessionRouteError.inputUnavailable)
    }

    private func markSmoke(_ id: RealDeviceSmokeCheckID, status: RealDeviceSmokeCheckStatus, detail: String = "") {
        realDeviceChecklist.mark(id, status: status, detail: detail)
        realDeviceChecks = realDeviceChecklist.checks
    }

    private func formatBackendLatency(_ summary: [String: JSONValue]) -> [String] {
        let fields: [(String, String)] = [
            ("transcriptToAssistantTextMs", "Transcript -> assistant text"),
            ("asrToCueMs", "ASR -> cue"),
            ("cueToGatewayInstructionMs", "Cue -> gateway instruction"),
            ("subagentDurationMs", "Subagent duration")
        ]
        var rows = fields.compactMap { key, label -> String? in
            guard let value = summary[key]?.numberValue else { return nil }
            return "\(label): \(Int(value)) ms"
        }
        if let warnings = summary["warnings"]?.arrayValue {
            let joined = warnings.compactMap(\.stringValue).joined(separator: ", ")
            if !joined.isEmpty {
                rows.append("Warnings: \(joined)")
            }
        } else if let warning = summary["warnings"]?.stringValue, !warning.isEmpty {
            rows.append("Warnings: \(warning)")
        }
        if rows.isEmpty {
            rows.append("No backend latency metrics available yet.")
        }
        return rows
    }

    private func handleAuthCode(_ code: String?) {
        guard code == "auth_missing" || code == "auth_invalid" else { return }
        appState?.markTokenInvalid()
        refreshTokenState()
    }

    private func run(_ operation: @escaping () async throws -> Void) {
        guard !isBusy else { return }
        isBusy = true
        Task {
            defer { isBusy = false }
            do {
                try await operation()
            } catch {
                status = error.localizedDescription
                stopLocalAudio(reason: "Operation failed")
                appState?.appendLocal(message: status)
            }
        }
    }

    private func send(_ operation: @escaping () async throws -> Void) {
        Task {
            do {
                try await operation()
                if status.isEmpty || status == "Disconnected" {
                    status = "Last command sent"
                }
            } catch {
                status = error.localizedDescription
                appState?.appendLocal(message: status)
            }
        }
    }
}
