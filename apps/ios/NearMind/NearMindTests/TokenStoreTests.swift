import XCTest
@testable import NearMind

final class TokenStoreTests: XCTestCase {
    func testMockTokenStoreSavesAndClears() throws {
        let store = MockTokenStore()

        XCTAssertNil(try store.readToken())
        try store.saveToken("test.jwt")
        XCTAssertEqual(try store.readToken(), "test.jwt")
        try store.clearToken()
        XCTAssertNil(try store.readToken())
    }

    func testProductionTokenStoreCompiles() {
        let keychain = KeychainStore(service: "ai.nearmind.app.tests")
        let store: TokenStoreProtocol = KeychainTokenStore(keychain: keychain)
        XCTAssertNotNil(store)
    }
}

private final class MockTokenStore: TokenStoreProtocol {
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
