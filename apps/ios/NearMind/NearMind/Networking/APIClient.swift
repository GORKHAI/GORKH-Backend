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
        try await requestRaw(.health).raw
    }

    @discardableResult
    func getHealthReady() async throws -> APIJSONResponse<HealthResponse> {
        try await request(.healthReady, as: HealthResponse.self)
    }

    @discardableResult
    func getBrainDashboard() async throws -> [String: JSONValue] {
        try await requestRaw(.brainDashboard).raw
    }

    @discardableResult
    func postBrainQuery(_ brainQuery: BrainQueryRequest) async throws -> APIJSONResponse<BrainQueryResponse> {
        let body = try JSONEncoder().encode(brainQuery)
        return try await request(.brainQuery, method: .post, body: body, as: BrainQueryResponse.self)
    }

    @discardableResult
    func getHumanProfileReview() async throws -> APIJSONResponse<ProfileReviewResponse> {
        try await request(.humanProfileReview, as: ProfileReviewResponse.self)
    }

    @discardableResult
    func getMobileSync(cursor: String?) async throws -> APIJSONResponse<MobileSyncResponse> {
        try await request(.mobileSync(cursor: cursor), as: MobileSyncResponse.self)
    }

    @discardableResult
    func getMobileSessionState(sessionID: String?) async throws -> APIJSONResponse<SessionStateResponse> {
        try await request(.mobileSessionState(sessionID: sessionID), as: SessionStateResponse.self)
    }

    @discardableResult
    func getSessionLatencySummary(sessionID: String?) async throws -> APIJSONResponse<LatencySummaryResponse> {
        try await request(.sessionLatencySummary(sessionID: sessionID), as: LatencySummaryResponse.self)
    }

    private func request<T: Decodable>(
        _ endpoint: Endpoint,
        method: HTTPMethod = .get,
        body: Data? = nil,
        as type: T.Type
    ) async throws -> APIJSONResponse<T> {
        let raw = try await requestRaw(endpoint, method: method, body: body)
        let decoded = try? decoder.decode(T.self, from: raw.data)
        return APIJSONResponse(decoded: decoded, raw: raw.raw, rawJSON: raw.rawJSON)
    }

    private func requestRaw(_ endpoint: Endpoint, method: HTTPMethod = .get, body: Data? = nil) async throws -> RawAPIResponse {
        var request = URLRequest(url: try endpoint.url(relativeTo: config.apiBaseURL))
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        if let token = try tokenStore.readToken(), !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw APIClientError.httpStatus(httpResponse.statusCode, decodeMobileError(from: data))
        }

        if data.isEmpty {
            return RawAPIResponse(data: data, raw: [:], rawJSON: "{}")
        }

        guard let raw = try? decoder.decode([String: JSONValue].self, from: data) else {
            throw APIClientError.invalidJSON
        }
        return RawAPIResponse(data: data, raw: raw, rawJSON: String(decoding: data, as: UTF8.self))
    }

    private func decodeMobileError(from data: Data) -> MobileError? {
        if let envelope = try? decoder.decode(MobileErrorEnvelope.self, from: data) {
            return envelope.error
        }
        return try? decoder.decode(MobileError.self, from: data)
    }
}

struct APIJSONResponse<T: Decodable> {
    let decoded: T?
    let raw: [String: JSONValue]
    let rawJSON: String
}

private struct RawAPIResponse {
    let data: Data
    let raw: [String: JSONValue]
    let rawJSON: String
}

private struct MobileErrorEnvelope: Decodable {
    let error: MobileError
}
