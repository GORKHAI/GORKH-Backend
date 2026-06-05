import Foundation

struct AppConfig: Equatable {
    let apiBaseURL: URL
    let gatewayWebSocketURL: URL
    let gatewayHTTPURL: URL

    static let production = AppConfig(
        apiBaseURL: URL(string: "https://api.gorkh.com")!,
        gatewayWebSocketURL: URL(string: "wss://voice.gorkh.com/gateway/voice")!,
        gatewayHTTPURL: URL(string: "https://voice.gorkh.com")!
    )
}
