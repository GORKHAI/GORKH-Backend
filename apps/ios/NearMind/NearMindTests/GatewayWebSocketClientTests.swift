import XCTest
@testable import NearMind

final class GatewayWebSocketClientTests: XCTestCase {
    @MainActor
    func testRedactsTokenFromLogs() {
        let token = "header.payload.signature"
        let raw = #"{"type":"debug","authorization":"Bearer header.payload.signature"}"#
        let redacted = GatewayWebSocketClient.redactedForLog(raw, token: token)
        XCTAssertFalse(redacted.contains(token))
        XCTAssertTrue(redacted.contains("[redacted]"))
    }

    @MainActor
    func testSendAudioFrameFailsSafelyWhenSocketInactive() async throws {
        let client = GatewayWebSocketClient(
            config: .production,
            tokenStore: GatewayTestTokenStore(token: "test.jwt")
        )

        do {
            try await client.sendAudioFrame(Data([0x01, 0x02]))
            XCTFail("Expected inactive socket to reject audio")
        } catch let error as GatewayWebSocketError {
            XCTAssertEqual(error.localizedDescription, GatewayWebSocketError.notConnected.localizedDescription)
        }
    }
}

private final class GatewayTestTokenStore: TokenStoreProtocol {
    let token: String?

    init(token: String?) {
        self.token = token
    }

    func saveToken(_ token: String) throws {}
    func readToken() throws -> String? { token }
    func clearToken() throws {}
}
