import XCTest
@testable import NearMind

@MainActor
final class AuthAccountTests: XCTestCase {
    func testAccountPlanAndBillingDecode() throws {
        let json = """
        {
          "account": {
            "id": "user-1",
            "email": "alpha@example.com",
            "displayName": "Alpha",
            "providers": [{"provider":"dev","email":"alpha@example.com","emailVerified":true,"displayName":"Alpha","createdAt":"2026-06-06T00:00:00.000Z"}],
            "plan": {"planCode":"internal_alpha","status":"billing_not_enabled","billingEnabled":false,"source":"system","currentPeriodEnd":null,"displayName":"Internal Alpha","message":"Billing is not enabled in this alpha."},
            "deletionStatus": null,
            "createdAt": "2026-06-06T00:00:00.000Z"
          }
        }
        """.data(using: .utf8)!

        let decoded = try JSONDecoder().decode(AccountProfileResponse.self, from: json)

        XCTAssertEqual(decoded.account.displayLabel, "Alpha")
        XCTAssertEqual(decoded.account.plan.planCode, "internal_alpha")
        XCTAssertFalse(decoded.account.plan.billingEnabled)
        XCTAssertEqual(decoded.account.providers.first?.provider, "dev")
    }

    func testBillingDisabledDecode() throws {
        let json = #"{"billingEnabled":false,"provider":"none","message":"Billing is not enabled in this alpha."}"#.data(using: .utf8)!
        let decoded = try JSONDecoder().decode(BillingStatus.self, from: json)

        XCTAssertFalse(decoded.billingEnabled)
        XCTAssertEqual(decoded.provider, "none")
    }

    func testDisabledAuthErrorsDecodeStableCodes() throws {
        let apple = #"{"error":{"code":"apple_sign_in_not_enabled","message":"Sign in with Apple is not enabled in this alpha.","retryable":false,"details":{"configured":false}}}"#.data(using: .utf8)!
        let email = #"{"error":{"code":"email_auth_not_enabled","message":"Email sign-in is not enabled in this alpha.","retryable":false,"details":{"configured":false}}}"#.data(using: .utf8)!

        XCTAssertEqual(try JSONDecoder().decode(AuthErrorEnvelope.self, from: apple).error.code, "apple_sign_in_not_enabled")
        XCTAssertEqual(try JSONDecoder().decode(AuthErrorEnvelope.self, from: email).error.code, "email_auth_not_enabled")
    }

    func testAuthStateUsesTokenStoreOnly() throws {
        let store = AuthTestTokenStore()
        let appState = makeAppState(tokenStore: store)

        appState.refreshAuthStatus()
        XCTAssertFalse(appState.isAuthenticated)
        XCTAssertEqual(appState.tokenStatus, .missing)

        try appState.saveAuthenticatedToken("test.jwt")
        XCTAssertEqual(try store.readToken(), "test.jwt")
        XCTAssertTrue(appState.isAuthenticated)
        XCTAssertEqual(appState.tokenStatus, .stored)

        try store.clearToken()
        appState.refreshAuthStatus()
        XCTAssertFalse(appState.isAuthenticated)
    }

    func testAuthRequestPayloadsDoNotContainUserIdOrRawProviderSecrets() throws {
        let apple = AppleVerifyRequest(identityToken: "apple.identity.token", authorizationCode: "auth.code", fullName: "Alpha", email: "alpha@example.com", deviceLabel: "iPhone")
        let email = EmailStartRequest(email: "alpha@example.com")
        let encoder = JSONEncoder()

        XCTAssertFalse(String(decoding: try encoder.encode(apple), as: UTF8.self).contains("userId"))
        XCTAssertFalse(String(decoding: try encoder.encode(email), as: UTF8.self).contains("userId"))
    }

    private func makeAppState(tokenStore: TokenStoreProtocol) -> AppState {
        let config = AppConfig(
            apiBaseURL: URL(string: "https://api.gorkh.com")!,
            gatewayWebSocketURL: URL(string: "wss://voice.gorkh.com/gateway/voice")!,
            gatewayHTTPURL: URL(string: "https://voice.gorkh.com")!
        )
        return AppState(
            environment: AppEnvironment(
                config: config,
                tokenStore: tokenStore,
                apiClient: APIClient(config: config, tokenStore: tokenStore)
            )
        )
    }
}

private struct AuthErrorEnvelope: Decodable {
    let error: MobileError
}

private final class AuthTestTokenStore: TokenStoreProtocol {
    private var token: String?

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
