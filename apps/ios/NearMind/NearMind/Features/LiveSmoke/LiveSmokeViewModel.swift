import Foundation

@MainActor
final class LiveSmokeViewModel: ObservableObject {
    static let bankPrepText = "What should I ask before this bank loan meeting?"
    static let aprTranscript = "The APR is 9.4 percent and there is also an arrangement fee."

    @Published private(set) var checks = LiveSmokeCheck.defaults
    @Published private(set) var status = "Ready"
    @Published private(set) var isBusy = false

    private var checklist = LiveSmokeChecklist()
    private var apiClient: APIClient?
    private var gatewayClient: GatewayWebSocketClient?
    private weak var appState: AppState?

    var isGatewayConnected: Bool {
        gatewayClient?.isConnected == true
    }

    var lastSessionId: String? {
        gatewayClient?.lastSessionId
    }

    var lastVoiceSessionId: String? {
        gatewayClient?.lastVoiceSessionId
    }

    var lastGatewaySessionId: String? {
        gatewayClient?.lastGatewaySessionId
    }

    var gatewayEventCount: Int {
        gatewayClient?.eventCount ?? 0
    }

    func configure(environment: AppEnvironment, appState: AppState) {
        guard apiClient == nil else { return }
        self.appState = appState
        apiClient = APIClient(config: environment.config, tokenStore: environment.tokenStore)
        gatewayClient = GatewayWebSocketClient(config: environment.config, tokenStore: environment.tokenStore)
        refreshTokenCheck()
    }

    func refreshTokenCheck() {
        guard let appState else { return }
        appState.refreshAuthStatus()
        if appState.tokenStatus == .stored {
            set(.tokenStored, .passed, "JWT is stored in Keychain.")
        } else if appState.tokenStatus == .invalid {
            set(.tokenStored, .failed, "Stored token was rejected by backend auth.")
        } else {
            set(.tokenStored, .failed, "Add a test JWT in You → Developer.")
        }
    }

    func runAPIHealth() {
        run {
            guard let apiClient = self.apiClient else { return }
            self.set(.apiHealthReachable, .running, "Calling production API health endpoints.")
            let health = try await apiClient.getHealth()
            self.appState?.appendRaw(title: "GET /health", rawJSON: self.rawJSONString(health))
            let ready = try await apiClient.getHealthReady()
            self.appState?.appendRaw(title: "GET /health/ready", rawJSON: ready.rawJSON)
            self.set(.apiHealthReachable, .passed, "Health reachable. Ready ok=\(ready.decoded?.ok.map(String.init) ?? "unknown").")
        }
    }

    func connectGateway() {
        run(requiresToken: true) {
            self.set(.gatewayConnected, .running, "Connecting to production gateway.")
            try await self.connectGatewayClient()
            self.set(.gatewayConnected, .passed, "Gateway connected.")
        }
    }

    func startConversationSession() {
        run(requiresToken: true, requiresGateway: true) {
            guard let gatewayClient = self.gatewayClient else { return }
            self.set(.conversationStartAck, .running, "Starting conversation_agent typed session.")
            let payload = StartSessionPayload(
                policy: .conversationAgent,
                situationDescription: "I am going to the bank to discuss a loan.",
                title: "iOS typed live smoke bank prep",
                consentGranted: true
            )
            let event = try await gatewayClient.sendStartAndWaitForAck(payload, timeout: 12)
            if case .gatewayAck = event {
                self.set(.conversationStartAck, .passed, "Received gateway_ack. sessionId=\(gatewayClient.lastSessionId ?? "unknown").")
            } else {
                self.set(.conversationStartAck, .failed, "Expected gateway_ack, received \(event.displayName).")
            }
        }
    }

    func sendConversationText() {
        run(requiresToken: true, requiresGateway: true) {
            guard let gatewayClient = self.gatewayClient else { return }
            self.set(.conversationResponse, .running, "Sending typed user_text.")
            let event = try await gatewayClient.sendUserTextAndWaitForResponse(Self.bankPrepText, timeout: 20)
            switch event {
            case .voiceAssistantText, .voiceSpeakRequest, .gatewayClientTTSInstruction, .gatewayProviderError:
                self.set(.conversationResponse, .passed, "Received \(event.displayName).")
            default:
                self.set(.conversationResponse, .failed, "Expected assistant/provider event, received \(event.displayName).")
            }
        }
    }

    func stopConversationWithoutSaving() {
        run(requiresGateway: true) {
            try await self.gatewayClient?.sendStop(save: false)
            self.set(.conversationStopSent, .passed, "Sent stop save=false.")
            self.appState?.appendLocal(message: "Sent conversation stop save=false")
        }
    }

    func startWhisperSession() {
        run(requiresToken: true) {
            guard let gatewayClient = self.gatewayClient else { return }
            if gatewayClient.lastSessionId != nil {
                gatewayClient.disconnect()
            }
            if gatewayClient.isConnected != true {
                self.set(.gatewayConnected, .running, "Opening fresh gateway connection for whisper session.")
                try await self.connectGatewayClient()
                self.set(.gatewayConnected, .passed, "Gateway connected.")
            }
            self.set(.whisperStartAck, .running, "Starting whisper_copilot typed session.")
            let payload = StartSessionPayload(
                policy: .whisperCopilot,
                situationDescription: "I am reviewing bank loan terms.",
                title: "iOS typed live smoke APR whisper",
                consentGranted: true
            )
            let event = try await gatewayClient.sendStartAndWaitForAck(payload, timeout: 12)
            if case .gatewayAck = event {
                self.set(.whisperStartAck, .passed, "Received gateway_ack. sessionId=\(gatewayClient.lastSessionId ?? "unknown").")
            } else {
                self.set(.whisperStartAck, .failed, "Expected gateway_ack, received \(event.displayName).")
            }
        }
    }

    func sendWhisperTranscript() {
        run(requiresToken: true, requiresGateway: true) {
            guard let gatewayClient = self.gatewayClient else { return }
            self.set(.whisperCueReceived, .running, "Sending typed transcript.")
            let event = try await gatewayClient.sendTranscriptAndWaitForCue(Self.aprTranscript, timeout: 20)
            if case .voiceCue = event {
                self.set(.whisperCueReceived, .passed, "Received voice_cue.")
            } else {
                self.set(.whisperCueReceived, .failed, "Expected voice_cue, received \(event.displayName).")
            }
        }
    }

    func stopWhisperWithoutSaving() {
        run(requiresGateway: true) {
            try await self.gatewayClient?.sendStop(save: false)
            self.set(.whisperStopSaveFalse, .passed, "Sent stop save=false.")
            self.appState?.appendLocal(message: "Sent whisper stop save=false")
        }
    }

    func disconnectGateway() {
        gatewayClient?.disconnect()
        set(.gatewayConnected, .skipped, "Disconnected by user.")
        appState?.appendLocal(message: "Gateway disconnected")
    }

    func fetchMobileSync() {
        run(requiresToken: true) {
            guard let apiClient = self.apiClient else { return }
            self.set(.mobileSyncFetched, .running, "Fetching /mobile/sync.")
            let response = try await apiClient.getMobileSync(cursor: nil)
            self.appState?.appendRaw(title: "GET /mobile/sync", rawJSON: response.rawJSON)
            self.set(.mobileSyncFetched, .passed, "Fetched \(response.decoded?.items.count ?? 0) sync items.")
        }
    }

    func fetchSessionState() {
        run(requiresToken: true) {
            guard let apiClient = self.apiClient else { return }
            guard let sessionId = self.lastSessionId else {
                self.set(.sessionStateFetched, .skipped, "No sessionId yet.")
                return
            }
            self.set(.sessionStateFetched, .running, "Fetching mobile session state.")
            let response = try await apiClient.getMobileSessionState(sessionID: sessionId)
            self.appState?.appendRaw(title: "GET /mobile/sessions/:id/state", rawJSON: response.rawJSON)
            self.set(.sessionStateFetched, .passed, "Fetched state \(response.decoded?.status ?? "unknown").")
        }
    }

    func fetchLatencySummary() {
        run(requiresToken: true) {
            guard let apiClient = self.apiClient else { return }
            guard let sessionId = self.lastSessionId else {
                self.set(.latencySummaryFetched, .skipped, "No sessionId yet.")
                return
            }
            self.set(.latencySummaryFetched, .running, "Fetching latency summary.")
            let response = try await apiClient.getSessionLatencySummary(sessionID: sessionId)
            self.appState?.appendRaw(title: "GET /sessions/:id/latency-summary", rawJSON: response.rawJSON)
            self.set(.latencySummaryFetched, .passed, "Fetched latency summary for \(response.decoded?.sessionId ?? sessionId).")
        }
    }

    private func run(
        requiresToken: Bool = false,
        requiresGateway: Bool = false,
        _ operation: @escaping () async throws -> Void
    ) {
        guard !isBusy else { return }
        if requiresToken, !requireToken() { return }
        if requiresGateway, gatewayClient?.isConnected != true {
            status = "Connect to the gateway first."
            return
        }
        isBusy = true
        Task {
            defer { isBusy = false }
            do {
                try await operation()
                status = "Last check completed."
                set(.noCrash, .passed, "App remained responsive.")
            } catch {
                handle(error)
            }
        }
    }

    private func requireToken() -> Bool {
        refreshTokenCheck()
        guard appState?.tokenStatus == .stored else {
            status = "Sign in or add a test JWT in You → Developer first."
            return false
        }
        return true
    }

    private func connectGatewayClient() async throws {
        guard let gatewayClient else { return }
        try await gatewayClient.connect(timeout: 10) { [weak self] event, rawJSON in
            Task { @MainActor in
                self?.handleGatewayEvent(event, rawJSON: rawJSON)
            }
        }
    }

    private func handleGatewayEvent(_ event: GatewayServerEvent, rawJSON: String) {
        appState?.append(event: event, rawJSON: rawJSON)
        switch event {
        case .error(let error):
            handleAuthCode(error.code)
        case .gatewayError(let payload):
            if let code = payload["code"]?.stringValue {
                handleAuthCode(code)
            }
        default:
            break
        }
    }

    private func handle(_ error: Error) {
        status = error.localizedDescription
        if let apiError = error as? APIClientError {
            handleAuthCode(apiError.mobileErrorCode)
        }
        appState?.appendLocal(message: error.localizedDescription)
        set(.noCrash, .passed, "App remained responsive after error.")
    }

    private func handleAuthCode(_ code: String?) {
        guard code == "auth_missing" || code == "auth_invalid" else { return }
        appState?.markTokenInvalid()
        set(.tokenStored, .failed, "Stored token was rejected by backend auth.")
    }

    private func set(_ id: LiveSmokeCheckID, _ status: LiveSmokeCheckStatus, _ detail: String) {
        checklist.update(id, status: status, detail: detail)
        checks = checklist.checks
        self.status = detail
    }

    private func rawJSONString(_ raw: [String: JSONValue]) -> String {
        guard let data = try? JSONEncoder().encode(raw) else { return "{}" }
        return String(decoding: data, as: UTF8.self)
    }
}
