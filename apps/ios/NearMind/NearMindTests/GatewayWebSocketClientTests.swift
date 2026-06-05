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
}
