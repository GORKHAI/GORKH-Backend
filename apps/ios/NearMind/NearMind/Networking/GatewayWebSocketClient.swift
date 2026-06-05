import Foundation

typealias GatewayEventHandler = (GatewayServerEvent, String) -> Void

enum GatewayWebSocketError: Error, LocalizedError {
    case missingToken
    case invalidMessage
    case notConnected
    case sessionNotActive
    case timedOut(String)

    var errorDescription: String? {
        switch self {
        case .missingToken:
            return "Paste and save a test JWT before connecting."
        case .invalidMessage:
            return "The gateway returned a message type NearMind cannot display."
        case .notConnected:
            return "Connect to the gateway first."
        case .sessionNotActive:
            return "Start a gateway session before streaming audio."
        case .timedOut(let label):
            return "\(label) timed out."
        }
    }
}

@MainActor
protocol GatewayVoiceClientProtocol: AnyObject {
    var isConnected: Bool { get }
    var sessionActive: Bool { get }
    var canSendAudio: Bool { get }
    var lastSessionId: String? { get }
    func connect(timeout seconds: TimeInterval, onEvent: @escaping GatewayEventHandler) async throws
    func sendStart(_ payload: StartSessionPayload) async throws
    func sendStartAndWaitForAck(_ payload: StartSessionPayload, timeout seconds: TimeInterval) async throws -> GatewayServerEvent
    func sendUserText(_ text: String) async throws
    func sendTranscript(_ text: String) async throws
    func sendSpeechStarted() async throws
    func sendSpeechEnded() async throws
    func sendStop(save: Bool) async throws
    func sendAudioFrame(_ data: Data) async throws
    func disconnect()
}

@MainActor
final class GatewayWebSocketClient: ObservableObject, GatewayVoiceClientProtocol {
    typealias EventHandler = GatewayEventHandler
    enum ConnectionState: String {
        case disconnected
        case connecting
        case connected
        case failed
    }

    @Published private(set) var isConnected = false
    @Published private(set) var connectionState: ConnectionState = .disconnected
    @Published private(set) var lastSessionId: String?
    @Published private(set) var lastVoiceSessionId: String?
    @Published private(set) var lastGatewaySessionId: String?
    @Published private(set) var lastErrorCode: String?
    @Published private(set) var eventCount = 0
    @Published private(set) var sessionActive = false

    var canSendAudio: Bool {
        isConnected && sessionActive
    }

    private let config: AppConfig
    private let tokenStore: TokenStoreProtocol
    private let session: URLSession
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private var task: URLSessionWebSocketTask?
    private var receiveTask: Task<Void, Never>?
    private var eventHandler: EventHandler?
    private var currentToken: String?
    private var waiters: [EventWaiter] = []

    init(config: AppConfig, tokenStore: TokenStoreProtocol, session: URLSession = .shared) {
        self.config = config
        self.tokenStore = tokenStore
        self.session = session
    }

    func connect(onEvent: @escaping EventHandler) throws {
        guard task == nil else { return }
        guard let token = try tokenStore.readToken(), !token.isEmpty else {
            throw GatewayWebSocketError.missingToken
        }

        var request = URLRequest(url: config.gatewayWebSocketURL)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        connectionState = .connecting
        currentToken = token
        eventHandler = onEvent
        let webSocketTask = session.webSocketTask(with: request)
        task = webSocketTask
        webSocketTask.resume()
        isConnected = true
        connectionState = .connected
        receiveTask = Task { [weak self] in
            await self?.receiveLoop()
        }
    }

    func connect(timeout seconds: TimeInterval, onEvent: @escaping EventHandler) async throws {
        try connect(onEvent: onEvent)
        do {
            try await withTimeout(seconds: seconds, label: "Gateway connect") { [weak self] in
                try await self?.sendPing()
            }
        } catch {
            disconnect()
            connectionState = .failed
            throw error
        }
    }

    func sendStart(_ payload: StartSessionPayload) async throws {
        sessionActive = false
        try await send(payload)
    }

    func sendStartAndWaitForAck(_ payload: StartSessionPayload, timeout seconds: TimeInterval) async throws -> GatewayServerEvent {
        sessionActive = false
        return try await sendAndWait(payload, timeout: seconds, label: "Start ack") { event in
            if case .gatewayAck = event { return true }
            if case .gatewayError = event { return true }
            return false
        }
    }

    func sendUserText(_ text: String) async throws {
        try await send(TextClientEvent(type: .userText, text: text))
    }

    func sendUserTextAndWaitForResponse(_ text: String, timeout seconds: TimeInterval) async throws -> GatewayServerEvent {
        try await sendAndWait(TextClientEvent(type: .userText, text: text), timeout: seconds, label: "Typed user_text response") { event in
            switch event {
            case .voiceAssistantText, .voiceSpeakRequest, .gatewayClientTTSInstruction, .gatewayProviderError, .gatewayError:
                return true
            default:
                return false
            }
        }
    }

    func sendTranscript(_ text: String) async throws {
        try await send(TextClientEvent(type: .transcript, text: text))
    }

    func sendTranscriptAndWaitForCue(_ text: String, timeout seconds: TimeInterval) async throws -> GatewayServerEvent {
        try await sendAndWait(TextClientEvent(type: .transcript, text: text), timeout: seconds, label: "Typed transcript response") { event in
            switch event {
            case .voiceCue, .voiceAssistantText, .gatewayProviderError, .gatewayError:
                return true
            default:
                return false
            }
        }
    }

    func sendSpeechStarted() async throws {
        try await send(BasicClientEvent(type: .speechStarted))
    }

    func sendSpeechEnded() async throws {
        try await send(BasicClientEvent(type: .speechEnded))
    }

    func sendStop(save: Bool) async throws {
        try await send(StopClientEvent(type: .stop, save: save))
        sessionActive = false
    }

    func sendAudioFrame(_ data: Data) async throws {
        guard let task, isConnected else {
            throw GatewayWebSocketError.notConnected
        }
        guard sessionActive else {
            throw GatewayWebSocketError.sessionNotActive
        }
        guard !data.isEmpty else { return }
        try await task.send(.data(data))
    }

    func disconnect() {
        waiters.forEach { $0.resume(nil) }
        waiters.removeAll()
        receiveTask?.cancel()
        receiveTask = nil
        task?.cancel(with: .normalClosure, reason: nil)
        task = nil
        isConnected = false
        connectionState = .disconnected
        currentToken = nil
        sessionActive = false
    }

    static func redactedForLog(_ text: String, token: String?) -> String {
        guard let token, !token.isEmpty else { return text }
        return text.replacingOccurrences(of: token, with: "[redacted]")
    }

    private func send<T: Encodable>(_ value: T) async throws {
        guard let task else {
            throw GatewayWebSocketError.notConnected
        }
        let data = try encoder.encode(value)
        let json = String(decoding: data, as: UTF8.self)
        try await task.send(.string(json))
    }

    private func sendAndWait<T: Encodable>(
        _ value: T,
        timeout seconds: TimeInterval,
        label: String,
        matching predicate: @escaping (GatewayServerEvent) -> Bool
    ) async throws -> GatewayServerEvent {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<GatewayServerEvent, Error>) in
            let waiter = EventWaiter(predicate: predicate) { event in
                if let event {
                    continuation.resume(returning: event)
                } else {
                    continuation.resume(throwing: GatewayWebSocketError.notConnected)
                }
            }
            self.waiters.append(waiter)
            Task {
                do {
                    try await self.send(value)
                } catch {
                    await MainActor.run {
                        if self.removeWaiter(id: waiter.id) {
                            continuation.resume(throwing: error)
                        }
                    }
                }
            }
            Task {
                try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
                await MainActor.run {
                    if self.removeWaiter(id: waiter.id) {
                        continuation.resume(throwing: GatewayWebSocketError.timedOut(label))
                    }
                }
            }
        }
    }

    private func sendPing() async throws {
        guard let task else {
            throw GatewayWebSocketError.notConnected
        }
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            task.sendPing { error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: ())
                }
            }
        }
    }

    private func receiveLoop() async {
        while !Task.isCancelled, let task {
            do {
                let message = try await task.receive()
                let rawJSON: String
                switch message {
                case .string(let string):
                    rawJSON = string
                case .data(let data):
                    rawJSON = String(decoding: data, as: UTF8.self)
                @unknown default:
                    throw GatewayWebSocketError.invalidMessage
                }

                let safeRawJSON = Self.redactedForLog(rawJSON, token: currentToken)
                let data = Data(safeRawJSON.utf8)
                let event = (try? decoder.decode(GatewayServerEvent.self, from: data))
                    ?? .unknown(type: nil, payload: [:])
                handle(event: event)
                eventHandler?(event, safeRawJSON)
            } catch {
                if !Task.isCancelled {
                    lastErrorCode = "client_receive_error"
                    eventHandler?(
                        .unknown(type: "client_receive_error", payload: [
                            "message": JSONValue(error.localizedDescription)
                        ]),
                        "{\"type\":\"client_receive_error\"}"
                    )
                }
                disconnect()
            }
        }
    }

    private func handle(event: GatewayServerEvent) {
        eventCount += 1
        switch event {
        case .gatewayAck(let payload):
            lastGatewaySessionId = payload["gatewaySessionId"]?.stringValue
            lastSessionId = payload["backendSessionId"]?.stringValue ?? payload["sessionId"]?.stringValue
            lastVoiceSessionId = payload["backendVoiceSessionId"]?.stringValue ?? payload["voiceSessionId"]?.stringValue
            sessionActive = true
        case .voiceAck(let payload):
            lastSessionId = payload["sessionId"]?.stringValue ?? lastSessionId
            lastVoiceSessionId = payload["voiceSessionId"]?.stringValue ?? lastVoiceSessionId
            sessionActive = true
        case .error(let error):
            lastErrorCode = error.code
        case .gatewayError(let payload):
            lastErrorCode = payload["code"]?.stringValue ?? "gateway_error"
        default:
            break
        }
        resolveWaiters(with: event)
    }

    private func resolveWaiters(with event: GatewayServerEvent) {
        let matching = waiters.filter { $0.predicate(event) }
        guard !matching.isEmpty else { return }
        waiters.removeAll { waiter in
            matching.contains { $0.id == waiter.id }
        }
        matching.forEach { $0.resume(event) }
    }

    @discardableResult
    private func removeWaiter(id: UUID) -> Bool {
        let existed = waiters.contains { $0.id == id }
        waiters.removeAll { $0.id == id }
        return existed
    }

    private func withTimeout<T>(
        seconds: TimeInterval,
        label: String,
        operation: @escaping () async throws -> T
    ) async throws -> T {
        try await withThrowingTaskGroup(of: T.self) { group in
            group.addTask {
                try await operation()
            }
            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
                throw GatewayWebSocketError.timedOut(label)
            }
            guard let value = try await group.next() else {
                throw GatewayWebSocketError.timedOut(label)
            }
            group.cancelAll()
            return value
        }
    }
}

private struct EventWaiter {
    let id = UUID()
    let predicate: (GatewayServerEvent) -> Bool
    let resume: (GatewayServerEvent?) -> Void
}

private struct BasicClientEvent: Encodable {
    let type: ClientEventType
}

private struct TextClientEvent: Encodable {
    let type: ClientEventType
    let text: String
}

private struct StopClientEvent: Encodable {
    let type: ClientEventType
    let save: Bool
}
