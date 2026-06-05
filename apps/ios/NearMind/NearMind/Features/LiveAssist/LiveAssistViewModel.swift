import Foundation

@MainActor
final class LiveAssistViewModel: ObservableObject {
    @Published var policy: AssistPolicy = .conversationAgent
    @Published var situationDescription = ""
    @Published var title = ""
    @Published var hasConsent = false
    @Published var typedUserText = ""
    @Published var typedTranscript = ""
    @Published private(set) var status = "Disconnected"
    @Published private(set) var isConnected = false

    private var client: GatewayWebSocketClient?
    private weak var appState: AppState?

    func configure(environment: AppEnvironment, appState: AppState) {
        guard client == nil else { return }
        self.appState = appState
        self.client = GatewayWebSocketClient(
            config: environment.config,
            tokenStore: environment.tokenStore
        )
    }

    func connect() {
        guard let client, let appState else { return }
        do {
            try client.connect { [weak appState] event, rawJSON in
                appState?.append(event: event, rawJSON: rawJSON)
            }
            isConnected = true
            status = "Connected"
            appState.appendLocal(message: "Gateway connected")
        } catch {
            status = error.localizedDescription
            appState.appendLocal(message: status)
        }
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
            consent: hasConsent
        )
        send {
            try await self.client?.sendStart(payload)
            self.appState?.appendLocal(message: "Sent start")
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

    func stopWithoutSaving() {
        send {
            try await self.client?.sendStop(save: false)
            self.appState?.appendLocal(message: "Sent stop save=false")
        }
    }

    func disconnect() {
        client?.disconnect()
        isConnected = false
        status = "Disconnected"
        appState?.appendLocal(message: "Gateway disconnected")
    }

    private func send(_ operation: @escaping () async throws -> Void) {
        Task {
            do {
                try await operation()
                status = "Last command sent"
            } catch {
                status = error.localizedDescription
                appState?.appendLocal(message: status)
            }
        }
    }
}
