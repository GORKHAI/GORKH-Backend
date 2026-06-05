import XCTest
@testable import NearMind

final class MobileErrorTests: XCTestCase {
    func testStableErrorShapeDecodes() throws {
        let json = #"{"code":"mobile_session_not_found","message":"Session not found","retryable":false,"details":{"sessionId":"s1"}}"#
        let error = try JSONDecoder().decode(MobileError.self, from: Data(json.utf8))

        XCTAssertEqual(error.code, "mobile_session_not_found")
        XCTAssertEqual(error.message, "Session not found")
        XCTAssertFalse(error.retryable)
        XCTAssertEqual(error.details?["sessionId"], JSONValue("s1"))
    }

    func testRetryableDecodes() throws {
        let json = #"{"code":"gateway_provider_timeout","message":"Try again","retryable":true}"#
        let error = try JSONDecoder().decode(MobileError.self, from: Data(json.utf8))

        XCTAssertTrue(error.retryable)
    }

    func testUnknownDetailsAreTolerated() throws {
        let json = #"{"code":"unknown","message":"Unknown","retryable":false,"details":{"nested":{"a":1},"array":["x",2,true]}}"#
        let error = try JSONDecoder().decode(MobileError.self, from: Data(json.utf8))

        XCTAssertEqual(error.code, "unknown")
        XCTAssertNotNil(error.details?["nested"])
        XCTAssertNotNil(error.details?["array"])
    }
}
