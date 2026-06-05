import Foundation

final class APIClient {
    private let config: AppConfig
    private let tokenStore: TokenStoreProtocol
    private let session: URLSession
    private let decoder = JSONDecoder()

    init(config: AppConfig, tokenStore: TokenStoreProtocol, session: URLSession = .shared) {
        self.config = config
        self.tokenStore = tokenStore
        self.session = session
    }

    @discardableResult
    func getHealth() async throws -> [String: JSONValue] {
        try await request(.health)
    }

    @discardableResult
    func getBrainDashboard() async throws -> [String: JSONValue] {
        try await request(.brainDashboard)
    }

    @discardableResult
    func getMobileSync(cursor: String?) async throws -> [String: JSONValue] {
        try await request(.mobileSync(cursor: cursor))
    }

    @discardableResult
    func getMobileSessionState(sessionID: String?) async throws -> [String: JSONValue] {
        try await request(.mobileSessionState(sessionID: sessionID))
    }

    private func request(_ endpoint: Endpoint) async throws -> [String: JSONValue] {
        var request = URLRequest(url: try endpoint.url(relativeTo: config.apiBaseURL))
        request.httpMethod = HTTPMethod.get.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let token = try tokenStore.readToken(), !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw APIClientError.httpStatus(httpResponse.statusCode)
        }

        if data.isEmpty {
            return [:]
        }

        return try decoder.decode([String: JSONValue].self, from: data)
    }
}
