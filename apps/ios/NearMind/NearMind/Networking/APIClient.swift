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
    func verifyAppleSignIn(_ appleRequest: AppleVerifyRequest) async throws -> APIJSONResponse<AuthTokenResponse> {
        let body = try JSONEncoder().encode(appleRequest)
        return try await request(.authAppleVerify, method: .post, body: body, as: AuthTokenResponse.self)
    }

    @discardableResult
    func startEmailSignIn(_ emailRequest: EmailStartRequest) async throws -> APIJSONResponse<EmptyResponse> {
        let body = try JSONEncoder().encode(emailRequest)
        return try await request(.authEmailStart, method: .post, body: body, as: EmptyResponse.self)
    }

    @discardableResult
    func verifyEmailSignIn(_ emailRequest: EmailVerifyRequest) async throws -> APIJSONResponse<AuthTokenResponse> {
        let body = try JSONEncoder().encode(emailRequest)
        return try await request(.authEmailVerify, method: .post, body: body, as: AuthTokenResponse.self)
    }

    @discardableResult
    func getAccountMe() async throws -> APIJSONResponse<AccountProfileResponse> {
        try await request(.accountMe, as: AccountProfileResponse.self)
    }

    @discardableResult
    func signOut() async throws -> APIJSONResponse<SignOutResponse> {
        try await request(.accountSignOut, method: .post, body: Data("{}".utf8), as: SignOutResponse.self)
    }

    @discardableResult
    func requestAccountDeletion(_ deleteRequest: DeleteAccountRequest) async throws -> APIJSONResponse<DeleteAccountResponse> {
        let body = try JSONEncoder().encode(deleteRequest)
        return try await request(.accountDeleteRequest, method: .post, body: body, as: DeleteAccountResponse.self)
    }

    @discardableResult
    func cancelAccountDeletion() async throws -> APIJSONResponse<DeleteAccountResponse> {
        try await request(.accountDeleteCancel, method: .post, body: Data("{}".utf8), as: DeleteAccountResponse.self)
    }

    @discardableResult
    func getPlanMe() async throws -> APIJSONResponse<PlanStatusResponse> {
        try await request(.planMe, as: PlanStatusResponse.self)
    }

    @discardableResult
    func getBillingStatus() async throws -> APIJSONResponse<BillingStatus> {
        try await request(.billingStatus, as: BillingStatus.self)
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

    @discardableResult
    func getRelayIdentity() async throws -> APIJSONResponse<RelayIdentityResponse> {
        try await request(.relayIdentity, as: RelayIdentityResponse.self)
    }

    @discardableResult
    func getRelayContacts() async throws -> APIJSONResponse<RelayContactsResponse> {
        try await request(.relayContacts, as: RelayContactsResponse.self)
    }

    @discardableResult
    func getRelayInbox() async throws -> APIJSONResponse<RelayRequestsResponse> {
        try await request(.relayInbox, as: RelayRequestsResponse.self)
    }

    @discardableResult
    func getRelayOutbox() async throws -> APIJSONResponse<RelayRequestsResponse> {
        try await request(.relayOutbox, as: RelayRequestsResponse.self)
    }

    @discardableResult
    func getRelayRequest(id: String?) async throws -> APIJSONResponse<RelayRequestResponse> {
        try await request(.relayRequest(id: id), as: RelayRequestResponse.self)
    }

    @discardableResult
    func draftRelayRequest(_ draft: RelayDraftRequest) async throws -> APIJSONResponse<RelayRequestResponse> {
        let body = try JSONEncoder().encode(draft)
        return try await request(.relayDraftRequest, method: .post, body: body, as: RelayRequestResponse.self)
    }

    @discardableResult
    func approveRelaySend(id: String?) async throws -> APIJSONResponse<RelayRequestResponse> {
        try await request(.relayApproveSend(id: id), method: .post, body: Data("{}".utf8), as: RelayRequestResponse.self)
    }

    @discardableResult
    func cancelRelayRequest(id: String?) async throws -> APIJSONResponse<RelayRequestResponse> {
        try await request(.relayCancel(id: id), method: .post, body: Data("{}".utf8), as: RelayRequestResponse.self)
    }

    @discardableResult
    func approveRelayRequest(id: String?, approvedPayload: [String: JSONValue] = [:]) async throws -> APIJSONResponse<RelayRequestResponse> {
        let body = try JSONEncoder().encode(RelayDecisionRequest(approvedPayload: approvedPayload))
        return try await request(.relayApprove(id: id), method: .post, body: body, as: RelayRequestResponse.self)
    }

    @discardableResult
    func rejectRelayRequest(id: String?, reason: String? = nil) async throws -> APIJSONResponse<RelayRequestResponse> {
        let body = try JSONEncoder().encode(RelayDecisionRequest(reason: reason))
        return try await request(.relayReject(id: id), method: .post, body: body, as: RelayRequestResponse.self)
    }

    @discardableResult
    func ignoreRelayRequest(id: String?) async throws -> APIJSONResponse<RelayRequestResponse> {
        try await request(.relayIgnore(id: id), method: .post, body: Data("{}".utf8), as: RelayRequestResponse.self)
    }

    @discardableResult
    func blockRelaySender(id: String?, reason: String? = nil) async throws -> APIJSONResponse<RelayRequestResponse> {
        let body = try JSONEncoder().encode(RelayDecisionRequest(reason: reason))
        return try await request(.relayBlockSender(id: id), method: .post, body: body, as: RelayRequestResponse.self)
    }

    @discardableResult
    func getRelayMessages(id: String?) async throws -> APIJSONResponse<RelayMessagesResponse> {
        try await request(.relayMessages(id: id), as: RelayMessagesResponse.self)
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
