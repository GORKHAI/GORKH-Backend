import XCTest
@testable import NearMind

final class TTSClientTests: XCTestCase {
    @MainActor
    func testVoiceSettingsDefaultsAreNativeWithFallback() {
        UserDefaults.standard.removeObject(forKey: "NearMind.voiceOutputMode")
        UserDefaults.standard.removeObject(forKey: "NearMind.naturalVoiceCharacter")
        UserDefaults.standard.removeObject(forKey: "NearMind.naturalVoiceFallbackEnabled")

        let appState = AppState(environment: makeEnvironment(token: "test.jwt"))

        XCTAssertEqual(appState.voiceOutputMode, .native)
        XCTAssertEqual(appState.naturalVoiceCharacter, .calmGuide)
        XCTAssertTrue(appState.naturalVoiceFallbackEnabled)
    }

    @MainActor
    func testSelectingNaturalVoiceAndCharacterPersists() {
        UserDefaults.standard.removeObject(forKey: "NearMind.voiceOutputMode")
        UserDefaults.standard.removeObject(forKey: "NearMind.naturalVoiceCharacter")
        let appState = AppState(environment: makeEnvironment(token: "test.jwt"))

        appState.setVoiceOutputMode(.natural)
        appState.setNaturalVoiceCharacter(.professional)

        let reloaded = AppState(environment: makeEnvironment(token: "test.jwt"))
        XCTAssertEqual(reloaded.voiceOutputMode, .natural)
        XCTAssertEqual(reloaded.naturalVoiceCharacter, .professional)
    }

    func testTTSClientRequestContainsNoUserIdAndUsesBearerToken() throws {
        let client = TTSClient(config: .production, tokenStore: TTSClientTestTokenStore(token: "secret.jwt.token"))
        let request = try client.makeURLRequest(
            TTSRequest(
                text: "NearMind voice test.",
                speechId: "speech-1",
                voiceCharacterId: .calmGuide,
                purpose: .assistantResponse
            )
        )

        XCTAssertEqual(request.url?.absoluteString, "https://voice.gorkh.com/tts/synthesize")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer secret.jwt.token")
        let body = String(data: try XCTUnwrap(request.httpBody), encoding: .utf8) ?? ""
        XCTAssertFalse(body.contains("userId"))
        XCTAssertFalse(body.contains("secret.jwt.token"))
        XCTAssertTrue(body.contains("calm_guide"))
    }

    private func makeEnvironment(token: String?) -> AppEnvironment {
        let store = TTSClientTestTokenStore(token: token)
        return AppEnvironment(
            config: .production,
            tokenStore: store,
            apiClient: APIClient(config: .production, tokenStore: store)
        )
    }
}

private final class TTSClientTestTokenStore: TokenStoreProtocol {
    private var token: String?

    init(token: String?) {
        self.token = token
    }

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
