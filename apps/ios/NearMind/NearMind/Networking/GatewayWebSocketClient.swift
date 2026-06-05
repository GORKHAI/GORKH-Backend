import Foundation

enum GatewayWebSocketError: Error, LocalizedError {
    case missingToken
    case invalidMessage
    case notConnected

    var errorDescription: String? {
        switch self {
        case .missingToken:
            return "Paste and save a test JWT before connecting."
        case .invalidMessage:
            return "The gateway returned a message type NearMind cannot display."
        case .notConnected:
            return "Connect to the gateway first."
        }
    }
}

@MainActor
final class GatewayWebSocketClient: ObservableObject {
    typealias EventHandler = (GatewayServerEvent, String) -> Void

    @Published private(set) var isConnected = false

    private let config: AppConfig
    private let tokenStore: TokenStoreProtocol
    private let session: URLSession
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private var task: URLSessionWebSocketTask?
    private var receiveTask: Task<Void, Never>?
    private var eventHandler: EventHandler?

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

        eventHandler = onEvent
        let webSocketTask = session.webSocketTask(with: request)
        task = webSocketTask
        webSocketTask.resume()
        isConnected = true
        receiveTask = Task { [weak self] in
            await self?.receiveLoop()
        }
    }

    func sendStart(_ payload: StartSessionPayload) async throws {
        try await send(payload)
    }

    func sendUserText(_ text: String) async throws {
        try await send(TextClientEvent(type: .userText, text: text))
    }

    func sendTranscript(_ text: String) async throws {
        try await send(TextClientEvent(type: .transcript, text: text))
    }

    func sendSpeechStarted() async throws {
        try await send(BasicClientEvent(type: .speechStarted))
    }

    func sendSpeechEnded() async throws {
        try await send(BasicClientEvent(type: .speechEnded))
    }

    func sendStop(save: Bool) async throws {
        try await send(StopClientEvent(type: .stop, save: save))
    }

    func disconnect() {
        receiveTask?.cancel()
        receiveTask = nil
        task?.cancel(with: .normalClosure, reason: nil)
        task = nil
        isConnected = false
    }

    private func send<T: Encodable>(_ value: T) async throws {
        guard let task else {
            throw GatewayWebSocketError.notConnected
        }
        let data = try encoder.encode(value)
        let json = String(decoding: data, as: UTF8.self)
        try await task.send(.string(json))
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

                let data = Data(rawJSON.utf8)
                let event = (try? decoder.decode(GatewayServerEvent.self, from: data))
                    ?? .unknown(type: nil, payload: [:])
                eventHandler?(event, rawJSON)
            } catch {
                if !Task.isCancelled {
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
